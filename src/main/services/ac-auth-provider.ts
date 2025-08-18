import { Logger } from '@nodescript/logger';
import { Request } from '@ubio/request';
import { config } from 'mesh-config';
import { dep } from 'mesh-ioc';

import { AcAuth } from '../ac-auth.js';
import { getSingleValue } from '../util.js';
import { AuthContext, AuthenticationError } from './auth-context.js';
import { AuthHeaders, AuthProvider } from './auth-provider.js';
import { JwtService } from './jwt.js';

export class AcAuthProvider extends AuthProvider<AcAuth> {
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

    async provide(headers: AuthHeaders) {
        const token = await this.getToken(headers);
        if (token) {
            const acAuth = await this.createAuthFromToken(headers, token);
            return new AuthContext(acAuth);
        }
        return new AuthContext(null);
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

    protected async getToken(headers: AuthHeaders) {
        const authHeaderName = this.AC_AUTH_HEADER_NAME;
        const upstreamAuth = getSingleValue(headers[authHeaderName]);
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
        const authorization = getSingleValue(headers['authorization']);
        if (authorization) {
            return await this.getTokenFromAuthMiddleware(authorization);
        }
    }

    protected async getTokenFromAuthMiddleware(authorization: string): Promise<string> {
        const cached = AcAuthProvider.middlewareTokensCache.get(authorization) || { authorisedAt: 0, token: '' };
        const invalid = cached.authorisedAt + AcAuthProvider.middlewareCacheTtl < Date.now();
        if (invalid) {
            try {
                const url = this.AC_AUTH_VERIFY_URL;
                const options = {
                    headers: { authorization },
                };
                const { token } = await this.clientRequest.get(url, options);
                AcAuthProvider.middlewareTokensCache.set(authorization, {
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
        const entries = AcAuthProvider.middlewareTokensCache.entries();
        for (const [k, v] of entries) {
            if (v.authorisedAt + AcAuthProvider.middlewareCacheTtl < now) {
                AcAuthProvider.middlewareTokensCache.delete(k);
            }
        }
    }
}

export class BypassAcAuthProvider extends AuthProvider<AcAuth> {

    async provide() {
        return new AuthContext(null);
    }

}
