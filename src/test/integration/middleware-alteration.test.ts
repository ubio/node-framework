import assert from 'assert';
import Koa from 'koa';
import supertest from 'supertest';

import { Application, Get, HttpServer, Router } from '../../main/index.js';

describe('Altering Middlewares', () => {
    class MyRouter extends Router {
        @Get({
            path: '/foo'
        })
        foo() {
            this.ctx.body = 'OK';
        }
    }

    const customMiddleware = {
        name: 'customMiddleware',
        middleware: async (ctx: Koa.Context, next: Koa.Next) => {
            ctx.set('custom-header', 'foo');

            return next();
        }
    };

    class CustomServer extends HttpServer {
        override addStandardMiddleware(): this {
            [customMiddleware, ...this.middlewares].forEach(m => this.use(m.middleware));

            return this;
        }
    }

    class App extends Application {

        override createGlobalScope() {
            const mesh = super.createGlobalScope();
            mesh.service(HttpServer, CustomServer);
            return mesh;
        }

        override createHttpRequestScope() {
            const mesh = super.createHttpRequestScope();
            mesh.service(MyRouter);
            return mesh;
        }

    }

    const app = new App();

    beforeEach(() => app.start());
    afterEach(() => app.stop());

    it('checks that the header was set by the custom middleware', async () => {
        const request = supertest(app.httpServer.callback());
        const res = await request.get('/foo');

        assert.strictEqual(res.headers['custom-header'], 'foo');
    });
});
