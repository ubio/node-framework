import assert from 'assert';
import { inject } from 'inversify';
import supertest from 'supertest';

import { AcAuth, AcAuthProvider, Application, Get, Router } from '../../main';

describe('Mocking AcAuth', () => {

    class MyRouter extends Router {
        constructor(
            @inject(AcAuth)
            protected auth: AcAuth,
        ) {
            super();
        }

        @Get({
            path: '/foo'
        })
        foo() {
            return { ...this.auth };
        }

    }

    const app = new Application();
    app.container.rebind(AcAuthProvider).toConstantValue({
        async provide() {
            return new AcAuth({
                jwtContext: {
                    organisation_id: 'foo',
                    service_account_id: 'service-account-worker',
                    service_account_name: 'Bot',
                }
            });
        }
    });
    app.bindRouter(MyRouter);

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
