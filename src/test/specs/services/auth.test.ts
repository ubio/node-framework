import { Container } from 'inversify';
import {
    Configuration,
    ForwardRequestHeaderAuthService,
    RequestFactory,
    AuthService,
    Logger,
    ConsoleLogger,
    RequestOptions,
    JWTAuthService,
} from '../../../main';
import assert from 'assert';
import { JWT, KeycloakJWTMock } from '../../../main/jwt';

describe('ForwardRequestHeaderAuthService', () => {
    let container: Container;
    let requestSent = false;
    let requestHeaders: any = {};

    beforeEach(() => {
        requestSent = false;
        requestHeaders = {};
        const request: any = {
            get(url: string, options: RequestOptions) {
                requestSent = true;
                requestHeaders = options.headers;
            }
        };
        container = new Container({ skipBaseClassChecks: true });
        container.bind(Configuration).toSelf();
        container.bind(Logger).to(ConsoleLogger);
        container.bind(AuthService).to(ForwardRequestHeaderAuthService);
        container.bind(RequestFactory).to(class extends RequestFactory {
            create() {
                return request;
            }
        });
    });

    context('authorization header valid', () => {

        it('sends a request with Authorization header', async () => {
            const authService = container.get(AuthService);
            const ctx: any = { req: { headers: { authorization: 'AUTH' } } };
            assert.equal(requestSent, false);
            await authService.authorize(ctx);
            assert.equal(requestSent, true);
            assert.equal(requestHeaders.authorization, 'AUTH');
        });

        it('does not send request if Authorization is cached', async () => {
            const ttl = 60000;
            const margin = 1000;
            const authService = container.get(AuthService) as ForwardRequestHeaderAuthService;
            authService.cacheTtl = ttl;
            authService.authorizedCache.set('AUTH', Date.now() - ttl + margin);
            const ctx: any = { req: { headers: { authorization: 'AUTH' } } };
            assert.equal(requestSent, false);
            await authService.authorize(ctx);
            assert.equal(requestSent, false);
        });

        it('still sends request if cache expires', async () => {
            const ttl = 60000;
            const margin = 1000;
            const authService = container.get(AuthService) as ForwardRequestHeaderAuthService;
            authService.cacheTtl = ttl;
            authService.authorizedCache.set('AUTH', Date.now() - ttl - margin);
            const ctx: any = { req: { headers: { authorization: 'AUTH' } } };
            assert.equal(requestSent, false);
            await authService.authorize(ctx);
            assert.equal(requestSent, true);
        });

    });

    context('authorization header does not exist', () => {

        it('throws AuthenticationError', async () => {
            const authService = container.get(AuthService);
            const ctx: any = { req: { headers: {} } };
            assert.equal(requestSent, false);
            try {
                await authService.authorize(ctx);
                throw new Error('Unexpected success');
            } catch (err) {
                assert.equal(err.code, 'AuthenticationError');
                assert.equal(requestSent, false);
            }
        });

    });

});

describe('JWTAuthService', () => {
    let container: Container;
    let jwtMock: KeycloakJWTMock;

    beforeEach(() => {
        container = new Container({ skipBaseClassChecks: true });
        container.bind(Configuration).toSelf();
        container.bind(Logger).to(ConsoleLogger);
        container.bind(KeycloakJWTMock).toSelf().inSingletonScope();
        container.bind(JWT).toService(KeycloakJWTMock);
        container.bind(AuthService).to(JWTAuthService).inSingletonScope();
        jwtMock = container.get(KeycloakJWTMock);
    });

    it('gets actorModel and actorId from token', async () => {
        const authService = container.get(AuthService);
        const token = jwtMock.createToken({ userId: 'some-user', organisationId: 'some-user-org-id' });
        const ctx: any = { req: { headers: { authorization: 'Bearer ' + token } } };
        await authService.authorize(ctx);

        assert.equal(ctx.actorModel, 'User');
        assert.equal(ctx.actorId, 'some-user');
        assert.equal(ctx.organisationId, 'some-user-org-id');
    });

    it('throws error when unexpected actor is decoded', async () => {
        const authService = container.get(AuthService);
        const token = jwtMock.createToken({ randomActor: 'some-user' });

        const ctx: any = { req: { headers: { authorization: 'Bearer ' + token } } };
        try {
            await authService.authorize(ctx);
            throw new Error('Unexpected success');
        } catch (err) {
            assert.equal(err.code, 'AuthenticationError');
        }
    });

    context('authorization header does not exist', () => {

        it('throws AuthenticationError', async () => {
            const authService = container.get(AuthService);
            const ctx: any = { req: { headers: {} } };
            try {
                await authService.authorize(ctx);
                throw new Error('Unexpected success');
            } catch (err) {
                assert.equal(err.code, 'AuthenticationError');
            }
        });

    });

});
