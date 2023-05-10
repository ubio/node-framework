import { config } from '@nodescript/config';
import { Logger } from '@nodescript/logger';
import { Request } from '@ubio/request';
import { dep } from 'mesh-ioc';

import { AcAuth, AuthenticationError } from '../ac-auth.js';
import { JwtService } from './jwt.js';

export type AuthHeaders = Record<string, string | string[] | undefined>;

export abstract class AcAuthProvider {
    abstract provide(headers: AuthHeaders): Promise<AcAuth>;
}

export class DefaultAcAuthProvider extends AcAuthProvider {
    clientRequest: Request;

    static middlewareCacheTtl: number = 60000;
    static middlewareTokensCache: Map<string, { token: string; authorisedAt: number }> = new Map();

    @config({ default: 'x-ubio-auth' }) AC_AUTH_HEADER_NAME!: string;
    @config({ default: 'http://auth-middleware.authz.svc.cluster.local:8080/verify' })
    AC_AUTH_VERIFY_URL!: string;

    @dep() protected logger!: Logger;
    @dep() protected jwt!: JwtService;

    constructor() {
        super();
        this.clientRequest = new Request({
            retryAttempts: 3,
        });
    }

    async provide(headers: AuthHeaders): Promise<AcAuth> {
        const token = await this.getToken(headers as any);
        if (token) {
            return await this.createAuthFromToken(headers, token);
        }
        return new AcAuth();
    }

    protected async createAuthFromToken(headers: AuthHeaders, token: string): Promise<AcAuth> {
        const organisationIdHeader = headers['x-ubio-organisation-id'] as string | undefined;
        try {
            const payload = await this.jwt.decodeAndVerify(token);
            const data = {
                organisation_id: organisationIdHeader,
                ...payload.context
            };
            return new AcAuth({
                jwtContext: data,
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
            return await this.getTokenFromAuthMiddleware(authorization);
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
                this.pruneCache();
                return token;
            } catch (error: any) {
                this.logger.warn('AuthMiddleware authentication failed', { ...error });
                throw new AuthenticationError();
            }
        }
        return cached.token;
    }

    pruneCache() {
        const now = Date.now();
        const entries = DefaultAcAuthProvider.middlewareTokensCache.entries();
        for (const [k, v] of entries) {
            if (v.authorisedAt + DefaultAcAuthProvider.middlewareCacheTtl < now) {
                DefaultAcAuthProvider.middlewareTokensCache.delete(k);
            }
        }
    }
}

export class BypassAcAuthProvider extends AcAuthProvider {

    async provide() {
        return new AcAuth();
    }

}
