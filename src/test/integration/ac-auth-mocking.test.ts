import assert from 'assert';
import { dep } from 'mesh-ioc';
import supertest from 'supertest';

import { AcAuth, Application, AuthContext, AuthProvider, Get, Router } from '../../main/index.js';

describe('Mocking AcAuth', () => {

    class MyRouter extends Router {

        @dep() protected auth!: AuthContext<AcAuth>;

        @Get({
            path: '/foo'
        })
        foo() {
            return { ...this.auth.getAuthToken() };
        }

    }

    class App extends Application {

        override createHttpRequestScope() {
            const mesh = super.createHttpRequestScope();
            mesh.service(MyRouter);
            mesh.constant(AuthProvider, {
                async provide() {
                    return new AuthContext(new AcAuth({
                        jwtContext: {
                            organisation_id: 'foo',
                            service_account_id: 'service-account-worker',
                            service_account_name: 'Bot',
                        }
                    }));
                }
            });
            return mesh;
        }

    }

    const app = new App();
    beforeEach(() => app.start());
    afterEach(() => app.stop());

    it('returns mocked data', async () => {
        const request = supertest(app.httpServer.callback());
        const res = await request.get('/foo');
        assert.deepStrictEqual(res.body, {
            actor: {
                type: 'ServiceAccount',
                id: 'service-account-worker',
                name: 'Bot',
                organisationId: 'foo',
            }
        });
    });
});
