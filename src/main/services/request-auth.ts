import { injectable, inject } from 'inversify';
import Koa from 'koa';
import Ajv from 'ajv';
import { Request } from '@automationcloud/request';
import { Exception } from '../exception';
import { JwtService, AutomationCloudDecodedJwt } from './jwt';
import { FrameworkEnv } from '../env';
import { AutomationCloudContext } from '../ac-context';
import { ajvErrorToMessage } from '../util';

const ajv = new Ajv({ messages: true });

@injectable()
export abstract class RequestAuthService {
    abstract async check(ctx: Koa.Context): Promise<void>;
}

@injectable()
export class RequestAuthServiceMock extends RequestAuthService {
    async check(_ctx: Koa.Context) {}
}

@injectable()
export class AutomationCloudAuthService extends RequestAuthService {
    clientRequest: Request;
    cacheTtl: number = 60000;
    // legacy forward header auth, deprecated
    authorizedCache: Map<string, number> = new Map();

    constructor(
        @inject(JwtService)
        protected jwt: JwtService,
        @inject(FrameworkEnv)
        protected env: FrameworkEnv,
        @inject(AutomationCloudContext)
        protected acContext: AutomationCloudContext,
    ) {
        super();
        const baseUrl = this.env.API_AUTH_URL; // for forwardRequestHeader
        this.clientRequest = new Request({
            baseUrl,
            retryAttempts: 3,
        });
    }

    async check(ctx: Koa.Context) {
        const authHeaderName = this.env.AC_AUTH_HEADER_NAME;
        const newAuthHeader = ctx.req.headers[authHeaderName] as string;
        if (newAuthHeader) {
            await this.handleNewAuth(newAuthHeader);
            return;
        }
        // Fallback to legacy header forwarding
        const legacyAuthHeader = ctx.req.headers['authorization'];
        if (legacyAuthHeader) {
            await this.handleLegacyAuth(legacyAuthHeader);
        }
    }

    protected async handleNewAuth(newAuthHeader: string) {
        const [prefix, token] = newAuthHeader.split(' ');
        if (prefix !== 'Bearer' || !token) {
            throw new Exception({
                name: 'AuthenticationError',
                message: `Incorrect authorization header (prefix=${prefix}, tokenExists=${!!token})`,
                status: 401
            });
        }
        try {
            const jwt = await this.jwt.decodeAndVerify(token);
            this.validateJwt(jwt);
            this.acContext.set({
                authenticated: true,
                organisationId: jwt.context.organisation_id ?? null,
                jwt,
            });
        } catch (error) {
            throw new Exception({
                name: 'AuthenticationError',
                status: 401,
                message: error.message,
                details: error
            });
        }
    }

    protected async handleLegacyAuth(legacyAuthHeader: string) {
        const authorizedAt = this.authorizedCache.get(legacyAuthHeader) || 0;
        const invalid = authorizedAt + this.cacheTtl < Date.now();
        if (invalid) {
            const endpoint = this.env.API_AUTH_ENDPOINT;
            try {
                await this.clientRequest.get(endpoint, {
                    headers: {
                        authorization: legacyAuthHeader,
                    }
                });
                this.authorizedCache.set(legacyAuthHeader, Date.now());
            } catch (error) {
                throw new Exception({
                    name: 'AuthenticationError',
                    status: 401,
                    message: error.message,
                    details: error
                });
            }
        }
        // Auth successful
        this.acContext.set({
            authenticated: true,
            organisationId: null,
            jwt: null,
        });
    }

    protected validateJwt(value: any): asserts value is AutomationCloudDecodedJwt {
        const validator = ajv.compile(acDecodedJwtSchema);
        const valid = validator(value);
        if (!valid) {
            throw new Exception({
                name: 'JwtValidationError',
                message: 'jwt payload does not conform to schema',
                details: {
                    messages: validator.errors?.map(e => ajvErrorToMessage(e)),
                },
            });
        }
    }
}

const acDecodedJwtSchema = {
    type: 'object',
    required: ['context', 'authentication', 'authorization'],
    properties: {
        context: {
            type: 'object',
            properties: {
                organisation_id: { type: 'string' },
                user_id:  { type: 'string' },
                job_id:  { type: 'string' },
                client_id:  { type: 'string' },
                service_user_id:  { type: 'string' },
                service_user_name:  { type: 'string' },
            }
        },
        authentication: {
            type: 'object',
            properties: {
                mechanism:  { type: 'string' },
                service:  { type: 'string' },
            }
        },
        authorization: {
            type: 'object',
            properties: {}
        }
    }
};
