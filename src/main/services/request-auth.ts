import { injectable, inject } from 'inversify';
import Koa from 'koa';
import { Request } from '@automationcloud/request';
import { Exception } from '../exception';
import { JwtService } from './jwt';
import { FrameworkEnv } from '../env';
import { AutomationCloudContext } from '../ac-context';

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
            this.acContext.set({
                authenticated: true,
                organisationId: jwt.context?.organisation_id ?? null,
                // TODO extract more stuff
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
        });
    }

}
