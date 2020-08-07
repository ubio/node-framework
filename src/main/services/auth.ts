import { injectable, inject } from 'inversify';
import Koa from 'koa';
import { Configuration, stringConfig } from '../config';
import { Logger } from '../logger';
import { Exception } from '../exception';
import { RequestFactory, Request } from '../request';
import { Jwt, DecodedJwt } from '../jwt';
import * as env from '../env';

const API_AUTH_URL = stringConfig('API_AUTH_URL', 'http://api-router-internal');
const API_AUTH_ENDPOINT = stringConfig('API_AUTH_ENDPOINT', '/private/access');

@injectable()
export abstract class AuthService {
    @inject(Logger)
    logger!: Logger;

    abstract async authorize(ctx: Koa.Context): Promise<void>;
    abstract getOrganisationId(): string | null;
}

@injectable()
export class AuthServiceMock extends AuthService {
    async authorize(_ctx: Koa.Context) {}
    getOrganisationId() { return null; }
}

/**@deprecated
 * since v4.3.0
 * use AutomationCloudAuthService instead
 */
@injectable()
export class ForwardRequestHeaderAuthService extends AuthService {
    request: Request;

    cacheTtl: number = 60000;
    authorizedCache: Map<string, number> = new Map();

    constructor(
        @inject(Configuration)
        protected config: Configuration,
        @inject(RequestFactory)
        requestFactory: RequestFactory,
    ) {
        super();
        this.config = config;
        const baseUrl = config.get(API_AUTH_URL);
        this.request = requestFactory.create({ baseUrl });
        // eslint-disable-next-line no-console
        console.warn('ForwardRequestHeaderAuthService is deprecated, use AutomationCloudAuthService instead');
    }

    getOrganisationId() { return null; }

    async authorize(ctx: Koa.Context) {
        const { authorization } = ctx.req.headers;
        if (!authorization) {
            throw new Exception({ name: 'AuthenticationError', status: 401 });
        }

        const authorizedAt = this.authorizedCache.get(authorization) || 0;
        const expired = authorizedAt + this.cacheTtl < Date.now();

        if (expired) {
            const endpoint = this.config.get(API_AUTH_ENDPOINT);
            await this.request.get(endpoint, { headers: { authorization } });
            this.authorizedCache.set(authorization, Date.now());
        }
    }
}

@injectable()
export class AutomationCloudAuthService extends AuthService {
    request: Request;
    cacheTtl: number = 60000;
    authorizedCache: Map<string, number> = new Map();
    payload: DecodedJwt | null = null;

    constructor(
        @inject(Jwt)
        protected jwt: Jwt,
        @inject(RequestFactory)
        requestFactory: RequestFactory,
    ) {
        super();
        const baseUrl = env.readString('API_AUTH_URL', 'http://api-router-internal');
        this.request = requestFactory.create({ baseUrl });
    }

    getOrganisationId() {
        return this.payload?.context?.organisation_id ?? null;
    }

    async authorize(ctx: Koa.Context) {
        const authHeaderName = env.readString('AC_AUTH_HEADER', '');
        const authorization = ctx.req.headers[authHeaderName] || '';
        // when jwt header is supplied by gateway
        if (authorization) {
            this.payload = await this.decodeJwt(Array.isArray(authorization) ? authorization[0] : authorization);
        } else {
            // for backward compatibility
            await this.forwardRequestHeader(ctx);
            this.payload = null;
        }
    }

    async decodeJwt(authorization: string) {
        const [method, token] = authorization.split(' ');
        if (method !== 'Bearer' || !token) {
            throw new Exception({ name: 'AuthenticationError', status: 401 });
        }
        try {
            return await this.jwt.decodeAndVerify(token);
        } catch (error) {
            throw new Exception({
                name: 'AuthenticationError',
                status: 401,
                message: error.message,
                details: error
            });
        }
    }

    async forwardRequestHeader(ctx: Koa.Context) {
        const { authorization } = ctx.req.headers;
        if (!authorization) {
            throw new Exception({ name: 'AuthenticationError', status: 401 });
        }

        const authorizedAt = this.authorizedCache.get(authorization) || 0;
        const expired = authorizedAt + this.cacheTtl < Date.now();

        if (expired) {
            const endpoint = env.readString('API_AUTH_ENDPOINT', '/private/access');
            await this.request.get(endpoint, { headers: { authorization } });
            this.authorizedCache.set(authorization, Date.now());
        }
    }
}
