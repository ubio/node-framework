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
    static authorizedCache: Map<string, { token: string, authorisedAt: number }> = new Map();

    constructor(
        @inject(JwtService)
        protected jwt: JwtService,
        @inject(FrameworkEnv)
        protected env: FrameworkEnv,
        @inject(AutomationCloudContext)
        protected acContext: AutomationCloudContext,
    ) {
        super();
        const baseUrl = this.env.AC_AUTH_MIDDLEWARE_URL;
        this.clientRequest = new Request({
            baseUrl,
            retryAttempts: 3,
        });
    }

    async check(ctx: Koa.Context) {
        const token = await this.getTokenFromHeader(ctx.req.headers as any);
        if (token) {
            const organisationHeader = ctx.req.headers['x-ubio-organisation-id'] as string;
            await this.verifyAuth(token, organisationHeader);
        }
    }

    protected async getTokenFromHeader(headers: { [name: string]: string | undefined }) {
        const authHeaderName = this.env.AC_AUTH_HEADER_NAME;
        const newAuthHeader = headers[authHeaderName];
        if (newAuthHeader) {
            const [prefix, token] = newAuthHeader.split(' ');
            if (prefix !== 'Bearer' || !token) {
                throw new Exception({
                    name: 'AuthenticationError',
                    message: `Incorrect authorization header (prefix=${prefix}, tokenExists=${!!token})`,
                    status: 401
                });
            }
            return token;
        }

        const legacyHeader = headers['authorization'];
        if (legacyHeader) {
            return this.handleLegacyAuth(legacyHeader);
        }
    }

    protected async verifyAuth(token: string, organisationHeader: string) {
        try {
            // TODO: add cache
            const jwt = await this.jwt.decodeAndVerify(token);
            this.acContext.set({
                authenticated: true,
                organisationId: jwt.context?.organisation_id ?? organisationHeader ?? null,
                serviceAccountId: jwt.context?.service_user_id ?? null,
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

    protected async handleLegacyAuth(legacyAuthHeader: string): Promise<string> {
        const { token: cachedToken, authorisedAt = 0 } = AutomationCloudAuthService.authorizedCache.get(legacyAuthHeader) || {};
        const invalid = authorisedAt + this.cacheTtl < Date.now();
        if (invalid || cachedToken == null) {
            const endpoint = this.env.API_AUTH_ENDPOINT;
            try {
                const { token } = await this.clientRequest.get(endpoint, {
                    headers: {
                        authorization: legacyAuthHeader,
                    }
                });
                AutomationCloudAuthService.authorizedCache.set(legacyAuthHeader, {
                    token,
                    authorisedAt: Date.now(),
                });
                return token;
            } catch (error) {
                throw new Exception({
                    name: 'AuthenticationError',
                    status: 401,
                    message: error.message,
                    details: error
                });
            }
        }

        return cachedToken;
    }
}
