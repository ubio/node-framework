import { injectable, inject } from 'inversify';
import Koa from 'koa';
import { Configuration, stringConfig } from '../config';
import { Logger } from '../logger';
import { Exception } from '../exception';
import { RequestFactory, Request } from '../request';
import { Jwt, DecodedJwt } from '../jwt';

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

@injectable()
export class JwtAuthService extends AuthService {
    constructor(
        @inject(Jwt)
        protected jwt: Jwt,
    ) {
        super();
    }

    async authorize(ctx: Koa.Context): Promise<void> {
        const { authorization } = ctx.req.headers;
        const token = authorization && authorization.split(' ')[0] === 'Bearer' && authorization.split(' ')[1];

        if (!token) {
            throw new Exception({ name: 'AuthenticationError', status: 401 });
        }

        try {
            const payload = await this.jwt.decodeAndVerify(token);

            const actor = this.getActorMeta(payload);
            ctx.state = {
                actorModel: actor.model,
                actorId: actor.id,
                organisationId: actor.organisationId,
            };
        } catch (error) {
            throw new Exception({
                name: 'AuthenticationError',
                status: 401,
                message: error.message,
                details: error
            });
        }
    }

    getActorMeta(payload: DecodedJwt) {
        let model: string | null = null;
        let id: string | null = null;

        const toString = (val: string | number | boolean | undefined) => {
            if (typeof val === 'string') return val;
            return '';
        };

        if (payload.serviceUserId) {
            model = 'ServiceUser';
            id = toString(payload.serviceUserId);
        } else if (payload.userId) {
            model = 'User';
            id = toString(payload.userId);
        } else if (payload.clientId) {
            model = 'Client';
            id = toString(payload.clientId);
        } else {
            throw new Exception({ name: 'InvalidJwtData' });
        }

        return {
            id,
            model,
            organisationId: toString(payload.organisationId),
        };
    }

}
