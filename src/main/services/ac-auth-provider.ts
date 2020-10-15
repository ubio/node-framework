import { injectable, inject } from 'inversify';
import Koa from 'koa';
import { Request } from '@automationcloud/request';
import { JwtService } from './jwt';
import { FrameworkEnv } from '../env';
import { AcAuth, AuthenticationError } from '../ac-auth';
import { Logger } from '../logger';

@injectable()
export abstract class AcAuthProvider {
    abstract async provide(): Promise<AcAuth>;
}

@injectable()
export class DefaultAcAuthProvider {
    clientRequest: Request;

    static legacyCacheTtl: number = 60000;
    static legacyTokensCache: Map<string, { token: string, authorisedAt: number }> = new Map();

    constructor(
        @inject(Logger)
        protected logger: Logger,
        @inject(JwtService)
        protected jwt: JwtService,
        @inject(FrameworkEnv)
        protected env: FrameworkEnv,
        @inject("KoaContext")
        protected ctx: Koa.Context,
    ) {
        this.clientRequest = new Request({
            retryAttempts: 3,
        });
    }

    async provide(): Promise<AcAuth> {
        const token = await this.getToken(this.ctx.req.headers as any);
        if (token) {
            return await this.createAuthFromToken(token);
        }
        return new AcAuth();
    }

    protected async createAuthFromToken(token: string): Promise<AcAuth> {
        const organisationIdHeader = this.ctx.req.headers['x-ubio-organisation-id'] as string;
        try {
            const jwt = await this.jwt.decodeAndVerify(token);
            return new AcAuth({
                authenticated: true,
                organisationId: jwt.context?.organisation_id ?? organisationIdHeader ?? null,
                serviceAccountId: jwt.context?.service_user_id ?? null,
            });
        } catch (err) {
            this.logger.warn(`Authentication from token failed`, { ...err });
            throw new AuthenticationError();
        }
    }

    protected async getToken(headers: { [name: string]: string | undefined }) {
        const authHeaderName = this.env.AC_AUTH_HEADER_NAME;
        const newAuthHeader = headers[authHeaderName];
        if (newAuthHeader) {
            const [prefix, token] = newAuthHeader.split(' ');
            if (prefix !== 'Bearer' || !token) {
                this.logger.warn(`Incorrect authorization header`, {
                    details: { prefix, token }
                });
                throw new AuthenticationError('Incorrect authorization header');
            }
            return token;
        }
        const legacyHeader = headers['authorization'];
        if (legacyHeader) {
            return this.getTokenFromLegacyAuth(legacyHeader);
        }
    }

    protected async getTokenFromLegacyAuth(legacyAuthHeader: string): Promise<string> {
        const cached = DefaultAcAuthProvider.legacyTokensCache.get(legacyAuthHeader) || { authorisedAt: 0, token: '' };
        const invalid = cached.authorisedAt + DefaultAcAuthProvider.legacyCacheTtl < Date.now();
        if (invalid) {
            try {
                const url = this.env.AC_AUTH_VERIFY_URL;
                const { token } = await this.clientRequest.get(url, {
                    headers: {
                        authorization: legacyAuthHeader,
                    }
                });
                DefaultAcAuthProvider.legacyTokensCache.set(legacyAuthHeader, {
                    token,
                    authorisedAt: Date.now(),
                });
                return token;
            } catch (error) {
                this.logger.warn('Legacy authentication failed', { ...error });
                throw new AuthenticationError();
            }
        }
        return cached.token;
    }
}
