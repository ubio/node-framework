import { injectable, inject } from 'inversify';
import Koa from 'koa';
import { Request } from '@automationcloud/request';
import { Logger } from '../logger';
import { Exception } from '../exception';
import { Jwt, DecodedJwt } from '../jwt';
import { FrameworkEnv } from '../env';

@injectable()
export abstract class AuthService {
    @inject(Logger)
    logger!: Logger;

    abstract async authorize(ctx: Koa.Context): Promise<void>;
    abstract getOrganisationId(): string | null;
}

@injectable()
export class AuthServiceMock extends AuthService {
    protected organisationId: string | null = null;
    async authorize(_ctx: Koa.Context) {}
    getOrganisationId() { return this.organisationId; }
    setOrganisationId(id: string) { this.organisationId = id; }
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
        @inject(FrameworkEnv)
        protected env: FrameworkEnv,
    ) {
        super();
        const baseUrl = this.env.API_AUTH_URL; // for forwardRequestHeader
        this.request = new Request({
            baseUrl,
            retryAttempts: 3,
        });
    }

    getOrganisationId() {
        return this.payload?.context?.organisation_id ?? null;
    }

    getPayload() {
        return this.payload;
    }

    async authorize(ctx: Koa.Context) {
        const authHeaderName = this.env.AC_AUTH_HEADER_NAME;
        const authorization = ctx.req.headers[authHeaderName] || '';
        // check auth header(jwt) supplied by gateway
        if (authorization) {
            this.payload = await this.decodeJwt(Array.isArray(authorization) ? authorization[0] : authorization);
        } else {
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

    // inherit from ForwardRequestHeaderAuthService
    async forwardRequestHeader(ctx: Koa.Context) {
        const { authorization } = ctx.req.headers;
        if (!authorization) {
            throw new Exception({ name: 'AuthenticationError', status: 401 });
        }

        const authorizedAt = this.authorizedCache.get(authorization) || 0;
        const expired = authorizedAt + this.cacheTtl < Date.now();

        if (expired) {
            const endpoint = this.env.API_AUTH_ENDPOINT;
            await this.request.get(endpoint, { headers: { authorization } });
            this.authorizedCache.set(authorization, Date.now());
        }
    }
}
