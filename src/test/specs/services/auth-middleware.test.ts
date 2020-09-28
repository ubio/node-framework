import { Container } from 'inversify';
import * as request from '@automationcloud/request';
import assert from 'assert';
import {
    Logger,
    ConsoleLogger,
    JwtService,
    Exception,
    AutomationCloudContext,
    AuthMiddleware,
    CustomMiddleware,
} from '../../../main';
import { FrameworkEnv } from '../../../main/env';

describe('AuthMiddleware', () => {
    let container: Container;
    let fetchMock: request.FetchMock;
    let acContext: AutomationCloudContext;
    let authService: AuthMiddleware;
    let jwt: any = {};

    beforeEach(() => {
        fetchMock = request.fetchMock({ status: 200 }, { token: 'jwt-token-here' });
        acContext = new AutomationCloudContext();
        container = new Container({ skipBaseClassChecks: true });
        container.bind(AutomationCloudContext).toConstantValue(acContext);
        container.bind(Logger).to(ConsoleLogger);
        container.bind(AuthMiddleware).toSelf();
        container.bind(CustomMiddleware).toService(AuthMiddleware);
        container.bind(JwtService).toConstantValue({
            async decodeAndVerify(token: string) {
                if (token !== 'jwt-token-here') {
                    throw new Exception({
                        name: 'InvalidJwtToken',
                        status: 400,
                    });
                }
                return jwt;
            }
        });

        container.bind(FrameworkEnv).toSelf().inSingletonScope();
        authService = container.get(AuthMiddleware);
        authService.clientRequest.config.fetch = fetchMock;
    });

    afterEach(() => {
        jwt = {};
        AuthMiddleware.authorizedCache = new Map();
    });

    context('new auth header exists', () => {
        let ctx: any;

        beforeEach(() => {
            const authHeader = container.get(FrameworkEnv).AC_AUTH_HEADER_NAME;
            const headers = { [authHeader]: 'Bearer jwt-token-here' };
            ctx = { req: { headers } };
        });

        describe('jwt payload has organisationId and serviceUserId', () => {
            it('does not send request to s-api', async () => {
                await authService.apply(ctx);
                assert.equal(fetchMock.spy.called, false);
            });

            it('sets acContext.authenticated = true', async () => {
                await authService.apply(ctx);
                assert(acContext.isAuthenticated());
            });

            context('jwt has organisation_id', () => {
                it('sets acContext.organisationId', async () => {
                    jwt = {
                        context: { organisation_id: 'some-user-org-id' },
                    };
                    await authService.apply(ctx);
                    assert.equal(fetchMock.spy.called, false);
                    const organisationId = acContext.getOrganisationId();
                    assert.equal(organisationId, 'some-user-org-id');
                });
            });

            context('x-ubio-organisation-id presents in header', () => {
                it('sets acContext.organisationId', async () => {
                    ctx.req.headers['x-ubio-organisation-id'] = 'org-id-from-header';
                    await authService.apply(ctx);
                    const organisationId = acContext.getOrganisationId();
                    assert.equal(organisationId, 'org-id-from-header');
                });
            });

            context('jwt has service_user_id', () => {
                it('returns serviceAccount from acContext', async () => {
                    jwt = {
                        context: { service_user_id: 'some-service-user-id' },
                    };
                    await authService.apply(ctx);
                    const serviceAccountId = acContext.getServiceAccountId();
                    assert.equal(serviceAccountId, 'some-service-user-id');
                });
            });
        });

        describe('unhappy cases', () => {
            it('throws when jwt is not valid', async () => {
                jwt = { context: {} };
                const authHeader = container.get(FrameworkEnv).AC_AUTH_HEADER_NAME;
                const headers = { [authHeader]: 'Bearer unknown-jwt-token' };
                const ctx: any = { req: { headers } };
                try {
                    await authService.apply(ctx);
                    assert(false, 'Unexpected success');
                } catch(err) {
                    assert.equal(acContext.isAuthenticated(), false);
                    assert.equal(err.name, 'AuthenticationError');
                }
            });
        });

    });

    context('legacy auth header exist & valid', () => {

        it('sends a request with Authorization header', async () => {
            const ctx: any = { req: { headers: { authorization: 'AUTH' } } };
            assert.equal(fetchMock.spy.called, false);
            await authService.apply(ctx);
            assert.equal(fetchMock.spy.called, true);
            const requestHeaders = fetchMock.spy.params[0]?.fetchOptions.headers;
            assert.equal(requestHeaders?.authorization, 'AUTH');
            assert.equal(acContext.isAuthenticated(), true);
        });

        it('does not send request if Authorization is cached', async () => {
            const ttl = 60000;
            const margin = 1000;

            authService.cacheTtl = ttl;
            AuthMiddleware.authorizedCache.set('AUTH', { token: 'jwt-token-here', authorisedAt: Date.now() - ttl + margin });
            const ctx: any = { req: { headers: { authorization: 'AUTH' } } };
            assert.equal(fetchMock.spy.called, false);
            await authService.apply(ctx);
            assert.equal(fetchMock.spy.called, false);
            assert.equal(acContext.isAuthenticated(), true);
        });

        it('still sends request if cache expires', async () => {
            const ttl = 60000;
            const margin = 1000;
            authService.cacheTtl = ttl;
            AuthMiddleware.authorizedCache.set('AUTH', { token: 'jwt-token-here', authorisedAt: Date.now() - ttl - margin });
            const ctx: any = { req: { headers: { authorization: 'AUTH' } } };
            assert.equal(fetchMock.spy.called, false);
            await authService.apply(ctx);
            assert.equal(fetchMock.spy.called, true);
            assert.equal(acContext.isAuthenticated(), true);
        });

        it('throws 401 if upstream request fails', async () => {
            authService.clientRequest.config.fetch = request.fetchMock({ status: 400 }, {}, new Error('RequestFailed'));
            const ctx: any = { req: { headers: { authorization: 'AUTH' } } };
            try {
                await authService.apply(ctx);
                assert.ok(false, 'unexpected success');
            } catch(err) {
                assert.equal(err.status, 401);
                assert.equal(acContext.isAuthenticated(), false);
            }
        });

        context('jwt has organisation_id', () => {
            it('sets acContext.organisationId', async () => {
                const ctx: any = { req: { headers: { authorization: 'AUTH' } } };
                jwt = {
                    context: { organisation_id: 'some-user-org-id' },
                };
                await authService.apply(ctx);
                assert.equal(fetchMock.spy.called, true);
                const organisationId = acContext.getOrganisationId();
                assert.equal(organisationId, 'some-user-org-id');
            });
        });

        context('x-ubio-organisation-id presents in header', () => {
            const ctx: any = { req: { headers: { authorization: 'AUTH' } } };
            it('sets acContext.organisationId', async () => {
                ctx.req.headers['x-ubio-organisation-id'] = 'org-id-from-header';
                await authService.apply(ctx);
                const organisationId = acContext.getOrganisationId();
                assert.equal(organisationId, 'org-id-from-header');
            });

            it('sets jwt.context.organisation_id if both present', async () => {
                ctx.req.headers['x-ubio-organisation-id'] = 'org-id-from-header';
                jwt = {
                    context: { organisation_id: 'org-id-from-jwt' },
                };
                await authService.apply(ctx);
                const organisationId = acContext.getOrganisationId();
                assert.equal(organisationId, 'org-id-from-jwt');
            });
        });

        context('jwt has service_user_id', () => {
            it('returns serviceAccount from acContext', async () => {
                const ctx: any = { req: { headers: { authorization: 'AUTH' } } };
                jwt = {
                    context: { service_user_id: 'some-service-user-id' },
                };
                await authService.apply(ctx);
                const serviceAccountId = acContext.getServiceAccountId();
                assert.equal(serviceAccountId, 'some-service-user-id');
            });
        });
    });

    context('authorization header does not exist', () => {

        it('leaves acContext unauthenticated', async () => {
            const ctx: any = { req: { headers: {} } };
            await authService.apply(ctx);
            assert.equal(acContext.isAuthenticated(), false);
        });

    });

});
