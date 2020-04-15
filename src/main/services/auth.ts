import { injectable, inject } from 'inversify';
import Koa from 'koa';
import { Configuration, stringConfig } from '../config';
import { Logger } from '../logger';
import { Exception } from '../exception';
import { RequestFactory, Request } from '../request';

const API_AUTH_URL = stringConfig('API_AUTH_URL', 'http://api-router-internal');
const API_AUTH_ENDPOINT = stringConfig('API_AUTH_ENDPOINT', '/private/access');

@injectable()
export abstract class AuthService {
    @inject(Logger)
    logger!: Logger;

    abstract async authorize(ctx: Koa.Context): Promise<void>;
}

@injectable()
export class AuthServiceMock extends AuthService {
    async authorize(_ctx: Koa.Context) {}
}

@injectable()
export class ForwardRequestHeaderAuthService extends AuthService {
    config: Configuration;
    request: Request;

    cacheTtl: number = 60000;
    authorizedCache: Map<string, number> = new Map();

    constructor(
        @inject(Configuration)
        config: Configuration,
        @inject(RequestFactory)
        requestFactory: RequestFactory,
    ) {
        super();
        this.config = config;
        const baseUrl = config.get(API_AUTH_URL);
        this.request = requestFactory.create({ baseUrl });
    }

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
