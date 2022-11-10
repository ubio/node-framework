import { Mesh } from '@flexent/mesh';
import assert from 'assert';
import supertest from 'supertest';

import {
    AcAuthProvider,
    Application,
    BypassAcAuthProvider,
} from '../../../main/index.js';
import { AccessRouter } from '../../routes/access.js';

describe('BypassAuthProvider', () => {

    class App extends Application {

        override defineGlobalScope(mesh: Mesh) {
            mesh.service(AcAuthProvider, BypassAcAuthProvider);
        }

        override defineHttpRequestScope(mesh: Mesh) {
            mesh.service(AccessRouter);
        }

        override async beforeStart() {
            await this.httpServer.startServer();
        }

        override async afterStop() {
            await this.httpServer.stopServer();
        }
    }

    const app = new App();
    beforeEach(() => app.start());
    afterEach(() => app.stop());

    context('route do not require authentication', () => {
        context('auth headers not provided', () => {
            it('does not return 401 when Authorization not provided', async () => {
                const request = supertest(app.httpServer.callback());
                const res = await request.get('/public');
                assert.ok(res.ok);
                assert.strictEqual(res.status, 200);
            });

            it('does not return 401 when x-ubio-auth not provided', async () => {
                const request = supertest(app.httpServer.callback());
                const res = await request.get('/public');
                assert.ok(res.ok);
                assert.strictEqual(res.status, 200);
            });
        });

        context('auth headers provided', () => {
            it('does not return 401 when Authorization found (does not try to authenticate)', async () => {
                const request = supertest(app.httpServer.callback());
                const res = await request
                    .get('/public')
                    .set('Authorization', 'Bearer some-token');
                assert.ok(res.ok);
                assert.strictEqual(res.status, 200);
            });

            it('does not return 401 when x-ubio-auth header found (does not try to authenticate)', async () => {
                const request = supertest(app.httpServer.callback());
                const res = await request
                    .get('/public')
                    .set('x-ubio-auth', 'Bearer some-token');
                assert.ok(res.ok);
                assert.strictEqual(res.status, 200);
            });
        });
    });

    context('route requires authentication (checkAuthenticated is called)', () => {
        it('returns 401 when auth headers not provided', async () => {
            const request = supertest(app.httpServer.callback());
            const res = await request.get('/secret');

            assert.ok(!res.ok);
            assert.strictEqual(res.status, 401);
        });

        it('returns 401 when auth headers provided', async () => {
            const request = supertest(app.httpServer.callback());
            const res = await request
                .get('/secret')
                .set('Authorization', 'Bearer some-token')
                .set('x-ubio-auth', 'Bearer some-token');
            assert.ok(!res.ok);
            assert.strictEqual(res.status, 401);
        });
    });
});
