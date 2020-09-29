import { injectable, inject } from 'inversify';
import Koa from 'koa';
import { Request } from '@automationcloud/request';
import { Exception } from '../exception';
import { JwtService } from './jwt';
import { FrameworkEnv } from '../env';
import { AutomationCloudContext } from '../ac-context';
import { CustomMiddleware } from '../custom-middleware';

@injectable()
export class AuthMiddleware extends CustomMiddleware {
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
        this.clientRequest = new Request({
            retryAttempts: 3,
        });
    }

    async apply(ctx: Koa.Context) {
        const token = await this.getToken(ctx.req.headers as any);
        if (token) {
            const organisationHeader = ctx.req.headers['x-ubio-organisation-id'] as string;
            await this.verify(token, organisationHeader);
        }
    }

    protected async getToken(headers: { [name: string]: string | undefined }) {
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
            return this.getTokenFromLegacyAuth(legacyHeader);
        }
    }

    protected async verify(token: string, organisationHeader: string) {
        try {
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

    protected async getTokenFromLegacyAuth(legacyAuthHeader: string): Promise<string> {
        const cached = AuthMiddleware.authorizedCache.get(legacyAuthHeader) || { authorisedAt: 0, token: '' };
        const invalid = cached.authorisedAt + this.cacheTtl < Date.now();
        if (invalid) {
            try {
                const url = this.env.AC_AUTH_VERIFY_URL;
                const { token } = await this.clientRequest.get(url, {
                    headers: {
                        authorization: legacyAuthHeader,
                    }
                });
                AuthMiddleware.authorizedCache.set(legacyAuthHeader, {
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
        return cached.token;
    }
}
