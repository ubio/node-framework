import { Request } from '@automationcloud/request';
import { inject, injectable } from 'inversify';
import Koa from 'koa';

import { AcAuth, AuthenticationError } from '../ac-auth';
import { Config, config } from '../config';
import { Logger } from '../logger';
import { JwtService } from './jwt';

@injectable()
export abstract class AcAuthProvider {
    abstract provide(): Promise<AcAuth>;
}

@injectable()
export class DefaultAcAuthProvider {
    clientRequest: Request;

    static middlewareCacheTtl: number = 60000;
    static middlewareTokensCache: Map<string, { token: string, authorisedAt: number }> = new Map();

    @config({ default: 'x-ubio-auth' }) AC_AUTH_HEADER_NAME!: string;
    @config({ default: 'http://auth-middleware.authz.svc.cluster.local:8080/verify' })
    AC_AUTH_VERIFY_URL!: string;

    constructor(
        @inject(Logger)
        protected logger: Logger,
        @inject(JwtService)
        protected jwt: JwtService,
        @inject(Config)
        public config: Config,
        @inject('KoaContext')
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
        const organisationIdHeader = this.ctx.req.headers['x-ubio-organisation-id'] as string | undefined;
        try {
            const payload = await this.jwt.decodeAndVerify(token);
            const data = {
                organisation_id: organisationIdHeader,
                ...payload.context
            }
            return new AcAuth({
                authenticated: true,
                data
            });
        } catch (err) {
            this.logger.warn(`Authentication from token failed`, { details: err });
            throw new AuthenticationError();
        }
    }

    protected async getToken(headers: { [name: string]: string | undefined }) {
        const authHeaderName = this.AC_AUTH_HEADER_NAME;
        const upstreamAuth = headers[authHeaderName];
        if (upstreamAuth) {
            const [prefix, token] = upstreamAuth.split(' ');
            if (prefix !== 'Bearer' || !token) {
                this.logger.warn(`Incorrect authorization header`, {
                    details: { prefix, token }
                });
                throw new AuthenticationError('Incorrect authorization header');
            }
            return token;
        }
        const authorization = headers['authorization'];
        if (authorization) {
            return this.getTokenFromAuthMiddleware(authorization);
        }
    }

    protected async getTokenFromAuthMiddleware(authorization: string): Promise<string> {
        const cached = DefaultAcAuthProvider.middlewareTokensCache.get(authorization) || { authorisedAt: 0, token: '' };
        const invalid = cached.authorisedAt + DefaultAcAuthProvider.middlewareCacheTtl < Date.now();
        if (invalid) {
            try {
                const url = this.AC_AUTH_VERIFY_URL;
                const options = {
                    headers: { authorization },
                };
                const { token } = await this.clientRequest.get(url, options);
                DefaultAcAuthProvider.middlewareTokensCache.set(authorization, {
                    token,
                    authorisedAt: Date.now(),
                });
                return token;
            } catch (error) {
                this.logger.warn('AuthMiddleware authentication failed', { ...error });
                throw new AuthenticationError();
            }
        }
        return cached.token;
    }
}
