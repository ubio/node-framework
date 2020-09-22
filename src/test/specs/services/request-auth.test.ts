import { Container } from 'inversify';
import { RequestOptions, Response } from '@automationcloud/request';
import assert from 'assert';
import {
    Logger,
    ConsoleLogger,
    AutomationCloudAuthService,
    JwtService,
    Exception,
    RequestAuthService,
    AutomationCloudContext,
} from '../../../main';
import { FrameworkEnv } from '../../../main/env';

describe('RequestAuthService', () => {
    let container: Container;
    let requestSent = false;
    let requestHeaders: any = {};
    let acContext: AutomationCloudContext;
    let authService: AutomationCloudAuthService;
    let jwt: any = {};

    beforeEach(() => {
        requestSent = false;
        requestHeaders = {};
        const fetchMock = (url: string, options: RequestOptions) => {
            requestSent = true;
            requestHeaders = options.headers;
            return Promise.resolve(new Response('{}'));
        };
        acContext = new AutomationCloudContext();
        container = new Container({ skipBaseClassChecks: true });
        container.bind(AutomationCloudContext).toConstantValue(acContext);
        container.bind(Logger).to(ConsoleLogger);
        container.bind(AutomationCloudAuthService).toSelf();
        container.bind(RequestAuthService).toService(AutomationCloudAuthService);
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
        authService = container.get(AutomationCloudAuthService);
        authService.clientRequest.config.fetch = fetchMock;
    });

    afterEach(() => {
       jwt = {};
    });

    context('new auth header exists', () => {
        describe('happy cases', () => {
            beforeEach(async () => {
                jwt = {
                    context: {
                        organisation_id: 'some-user-org-id',
                        service_user_id: 'some-service-user-id',
                    },
                };

                const authHeader = container.get(FrameworkEnv).AC_AUTH_HEADER_NAME;
                const headers = {} as any;
                headers[authHeader] = 'Bearer jwt-token-here';
                const ctx: any = { req: { headers } };
                await authService.check(ctx);
            });

            it('returns organisationId from acContext', async () => {
                const organisationId = acContext.getOrganisationId();
                assert.equal(organisationId, 'some-user-org-id');
            });

            it('returns serviceAccount from acContext', async () => {
                const serviceUserId = acContext.getServiceUserAccount();
                assert.equal(serviceUserId, 'some-service-user-id');
            });

            it('does not send request to s-api', async () => {
                assert.equal(requestSent, false);
            });
        });

        describe('unhappy cases', () => {
            it('throws when jwt is not valid', async () => {
                jwt = { context: {} };
                const authHeader = container.get(FrameworkEnv).AC_AUTH_HEADER_NAME;
                const headers = { [authHeader]: 'Bearer unknown-jwt-token' };
                const ctx: any = { req: { headers } };
                try {
                    await authService.check(ctx);
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
            assert.equal(requestSent, false);
            await authService.check(ctx);
            assert.equal(requestSent, true);
            assert.equal(requestHeaders.authorization, 'AUTH');
            assert.equal(acContext.isAuthenticated(), true);
        });

        it('does not send request if Authorization is cached', async () => {
            const ttl = 60000;
            const margin = 1000;

            authService.cacheTtl = ttl;
            authService.authorizedCache.set('AUTH', Date.now() - ttl + margin);
            const ctx: any = { req: { headers: { authorization: 'AUTH' } } };
            assert.equal(requestSent, false);
            await authService.check(ctx);
            assert.equal(requestSent, false);
            assert.equal(acContext.isAuthenticated(), true);
        });

        it('still sends request if cache expires', async () => {
            const ttl = 60000;
            const margin = 1000;
            authService.cacheTtl = ttl;
            authService.authorizedCache.set('AUTH', Date.now() - ttl - margin);
            const ctx: any = { req: { headers: { authorization: 'AUTH' } } };
            assert.equal(requestSent, false);
            await authService.check(ctx);
            assert.equal(requestSent, true);
            assert.equal(acContext.isAuthenticated(), true);
        });

        it('throws 401 if upstream request fails', async () => {
            authService = container.get(AutomationCloudAuthService);
            authService.clientRequest.config.fetch = () => { throw new Error('RequestFailed'); };
            const ctx: any = { req: { headers: { authorization: 'AUTH' } } };
            assert.equal(requestSent, false);
            try {
                await authService.check(ctx);
                assert.ok(false, 'unexpected success');
            } catch(err) {
                assert.equal(err.status, 401);
                assert.equal(acContext.isAuthenticated(), false);
            }
        });

    });

    context('authorization header does not exist', () => {

        it('leaves acContext unauthenticated', async () => {
            const ctx: any = { req: { headers: {} } };
            await authService.check(ctx);
            assert.equal(acContext.isAuthenticated(), false);
        });

    });

});
