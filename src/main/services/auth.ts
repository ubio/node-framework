import { injectable, inject } from 'inversify';
import Koa from 'koa';
import { Configuration, stringConfig } from '../config';
import { Logger } from '../logger';
import { Exception } from '../exception';
import { RequestFactory, Request } from '../request';
import * as jwt from '../jwt';

const API_AUTH_URL = stringConfig('API_AUTH_URL', 'http://api-router-internal');
const API_AUTH_ENDPOINT = stringConfig('API_AUTH_ENDPOINT', '/private/access');

const KEYCLOAK_ISSUER = stringConfig('KEYCLOAK_ISSUER', '');
const KEYCLOAK_JWKS_URI = stringConfig('KEYCLOAK_JWKS_URI', '');
const KEYCLOAK_AUDIENCE = stringConfig('KEYCLOAK_AUDIENCE', '');

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
export class JWTAuthService extends AuthService {
    protected jwtConfig: jwt.IssuerConfig;
    constructor(
        @inject(Configuration)
        protected config: Configuration,
    ) {
        super();
        this.config = config;

        const issuer = config.get(KEYCLOAK_ISSUER);
        const jwksUri = config.get(KEYCLOAK_JWKS_URI);
        const audiences = config.get(KEYCLOAK_AUDIENCE);

        if (!(issuer && jwksUri && audiences)) {
            throw new Exception({ name: 'ConfigurationError', message: 'JWTAuthService requires KEYCLOAK_ISSUER, KEYCLOAK_JWKS_URI and KEYCLOAK_AUDIENCE env values' });
        }

        this.jwtConfig = {
            issuer,
            jwksUri,
            audiences,
        };
    }

    async authorize(ctx: Koa.Context): Promise<void> {
        const { authorization } = ctx.req.headers;
        const token = authorization && authorization.split(' ')[0] === 'Bearer' && authorization.split(' ')[1];

        if (!token) {
            throw new Exception({ name: 'AuthenticationError', status: 401 });
        }

        try {
            const { actorId, actorModel, organisationId } = await jwt.decodeAndVerify(token, this.jwtConfig);
            ctx.set('organisationId', organisationId);
            ctx.set('actorModel', actorModel);
            ctx.set('actorId', actorId);
        } catch (error) {
            throw new Exception({
                name: 'AuthenticationError',
                status: 401,
                message: error.message,
                details: error
            });
        }
    }

}