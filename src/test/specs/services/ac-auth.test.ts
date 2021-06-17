import * as request from '@automationcloud/request';
import assert from 'assert';
import { Container } from 'inversify';

import {
    AcAuthProvider,
    AuthenticationError,
    Config,
    ConsoleLogger,
    DefaultAcAuthProvider,
    DefaultConfig,
    JwtService,
    Logger,
} from '../../../main';

describe('AcAuthProvider', () => {

    const container = new Container({ skipBaseClassChecks: true });
    container.bind(Logger).to(ConsoleLogger);
    container.bind(DefaultAcAuthProvider).toSelf();
    container.bind(AcAuthProvider).toService(DefaultAcAuthProvider);
    container.bind('KoaContext').toDynamicValue(() => ({
        req: { headers }
    }));
    container.bind(JwtService).toDynamicValue(() => ({
        async decodeAndVerify(token: string) {
            if (token !== 'jwt-token-here') {
                throw new AuthenticationError();
            }
            return jwt;
        }
    }));
    container.bind(Config).to(DefaultConfig);

    let fetchMock: request.FetchMock;
    let authProvider: DefaultAcAuthProvider;
    let headers: any = {};
    let jwt: any = {};

    beforeEach(() => {
        fetchMock = request.fetchMock({ status: 200 }, { token: 'jwt-token-here' });
        authProvider = container.get(DefaultAcAuthProvider);
        authProvider.clientRequest.config.fetch = fetchMock;
    });

    afterEach(() => {
        jwt = {};
        headers = {};
        DefaultAcAuthProvider.middlewareTokensCache = new Map();
    });

    describe('x-ubio-auth header exists', () => {

        beforeEach(() => {
            const authHeader = container.get(DefaultAcAuthProvider).AC_AUTH_HEADER_NAME;
            headers[authHeader] = 'Bearer jwt-token-here';
        });

        it('does not send request to authMiddleware', async () => {
            await authProvider.provide();
            assert.strictEqual(fetchMock.spy.called, false);
        });

        it('sets authenticated = true', async () => {
            const auth = await authProvider.provide();
            assert(auth.isAuthenticated());
        });

        context('jwt has organisation_id', () => {
            it('sets auth.organisationId', async () => {
                jwt.context = { organisation_id: 'some-user-org-id' };
                const auth = await authProvider.provide();
                assert.strictEqual(fetchMock.spy.called, false);
                const organisationId = auth.getOrganisationId();
                assert.strictEqual(organisationId, 'some-user-org-id');
            });
        });

        context('x-ubio-organisation-id presents in header', () => {
            it('sets auth.organisationId', async () => {
                headers['x-ubio-organisation-id'] = 'org-id-from-header';
                const auth = await authProvider.provide();
                const organisationId = auth.getOrganisationId();
                assert.strictEqual(organisationId, 'org-id-from-header');
            });
        });

        context('jwt has service_account_id', () => {
            it('returns serviceAccount from auth', async () => {
                jwt.context = {
                    service_account_id: 'some-service-account-id',
                    service_account_name: 'Bot'
                };
                const auth = await authProvider.provide();
                const serviceAccount = auth.getServiceAccount();
                assert.ok(serviceAccount);
                assert.strictEqual(serviceAccount.id, 'some-service-account-id');
                assert.strictEqual(serviceAccount.name, 'Bot');
            });
        });

        it('throws when jwt is not valid', async () => {
            const authHeader = container.get(DefaultAcAuthProvider).AC_AUTH_HEADER_NAME;
            headers[authHeader] = 'Bearer unknown-jwt-token';
            try {
                await authProvider.provide();
                throw new Error('UnexpectedSuccess');
            } catch (err) {
                assert.strictEqual(err.name, 'AuthenticationError');
            }
        });

    });

    describe('middleware auth', () => {
        it('sends a request to auth middleware with Authorization header', async () => {
            headers['authorization'] = 'AUTH';
            assert.strictEqual(fetchMock.spy.called, false);
            const auth = await authProvider.provide();
            assert.strictEqual(fetchMock.spy.called, true);
            const requestHeaders = fetchMock.spy.params[0]?.fetchOptions.headers;
            assert.strictEqual(requestHeaders?.authorization, 'AUTH');
            assert.strictEqual(auth.isAuthenticated(), true);
        });

        it('does not send request if Authorization is cached', async () => {
            const ttl = 60000;
            const margin = 1000;
            DefaultAcAuthProvider.middlewareCacheTtl = ttl;
            DefaultAcAuthProvider.middlewareTokensCache.set('AUTH', {
                token: 'jwt-token-here',
                authorisedAt: Date.now() - ttl + margin
            });
            headers['authorization'] = 'AUTH';
            assert.strictEqual(fetchMock.spy.called, false);
            const auth = await authProvider.provide();
            assert.strictEqual(fetchMock.spy.called, false);
            assert.strictEqual(auth.isAuthenticated(), true);
        });

        it('sends request if cache has expired', async () => {
            const ttl = 60000;
            const margin = 1000;
            DefaultAcAuthProvider.middlewareCacheTtl = ttl;
            DefaultAcAuthProvider.middlewareTokensCache.set('AUTH', { token: 'jwt-token-here', authorisedAt: Date.now() - ttl - margin });
            headers['authorization'] = 'AUTH';
            assert.strictEqual(fetchMock.spy.called, false);
            const auth = await authProvider.provide();
            assert.strictEqual(fetchMock.spy.called, true);
            assert.strictEqual(auth.isAuthenticated(), true);
        });

        it('throws 401 if upstream request fails', async () => {
            authProvider.clientRequest.config.fetch = request.fetchMock({ status: 400 }, {}, new Error('RequestFailed'));
            headers['authorization'] = 'AUTH';
            try {
                await authProvider.provide();
                throw new Error('UnexpectedSuccess');
            } catch (err) {
                assert.strictEqual(err.status, 401);
            }
        });

        context('jwt has organisation_id', () => {
            it('sets auth.organisationId', async () => {
                headers['authorization'] = 'AUTH';
                jwt.context = { organisation_id: 'some-user-org-id' };
                const auth = await authProvider.provide();
                assert.strictEqual(fetchMock.spy.called, true);
                const organisationId = auth.getOrganisationId();
                assert.strictEqual(organisationId, 'some-user-org-id');
            });
        });

        context('x-ubio-organisation-id presents in header', () => {

            beforeEach(() => {
                headers['authorization'] = 'AUTH';
            });

            it('sets auth.organisationId', async () => {
                headers['x-ubio-organisation-id'] = 'org-id-from-header';
                const auth = await authProvider.provide();
                const organisationId = auth.getOrganisationId();
                assert.strictEqual(organisationId, 'org-id-from-header');
            });

            it('sets jwt.context.organisation_id if both present', async () => {
                headers['x-ubio-organisation-id'] = 'org-id-from-header';
                jwt.context = { organisation_id: 'org-id-from-jwt' };
                const auth = await authProvider.provide();
                const organisationId = auth.getOrganisationId();
                assert.strictEqual(organisationId, 'org-id-from-jwt');
            });
        });

        context('jwt has service_account_id', () => {
            it('returns serviceAccount from auth', async () => {
                headers['authorization'] = 'AUTH';
                jwt.context = { service_account_id: 'Bot', service_account_name: 'Ron Swanson' };
                const auth = await authProvider.provide();
                const serviceAccount = auth.getServiceAccount();
                assert.ok(serviceAccount);
                assert.strictEqual(serviceAccount.id, 'Bot');
                assert.strictEqual(serviceAccount.name, 'Ron Swanson');
            });
        });
    });

    context('authorization header does not exist', () => {
        it('leaves auth unauthenticated', async () => {
            const auth = await authProvider.provide();
            assert.strictEqual(auth.isAuthenticated(), false);
        });

    });

});
