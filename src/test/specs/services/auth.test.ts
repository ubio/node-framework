import { Container } from 'inversify';
import {
    Configuration,
    ForwardRequestHeaderAuthService,
    RequestFactory,
    AuthService,
    Logger,
    ConsoleLogger,
    RequestOptions
} from '../../../main';
import assert from 'assert';

describe('ForwardRequestHeaderAuthService', () => {
    let container: Container;
    let requestSent: boolean = false;
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
