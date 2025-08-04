import { AfterHook, BodyParam, Exception, Get, Middleware, PathParam, Post, Put, Router } from '../../main/index.js';

export class FooRouter extends Router {

    @Middleware()
    async beforeAll() {
        this.ctx.set('foo-before-all', 'true');
    }

    @Middleware({ path: '/foo/{fooId}' })
    async beforeGetOne(
        @PathParam('fooId', { schema: { type: 'string' } })
        fooId: string
    ) {
        this.ctx.set('foo-before-get-one', fooId);
    }

    @Middleware({ ignorePaths: ['/foo/{fooId}'] })
    async beforeNotCreateOrUpdate() {
        this.ctx.set('foo-before-not-create-or-update', 'true');
    }

    @AfterHook({ ignorePaths: ['/foo/{fooId}'] })
    async afterNotCreateOrUpdate() {
        this.ctx.set('foo-after-not-create-or-update', 'true');
    }

    @AfterHook()
    async afterAll() {
        this.ctx.set('foo-after-all', 'true');
    }

    @AfterHook({
        path: '/foo-error'
    })
    async afterHideError() {
        this.ctx.set('foo-after-hide-error', 'true');
        this.error = null;
    }

    @Get({
        path: '/foo',
        responses: {
            200: { schema: { type: 'array', items: { type: 'string' } } }
        }
    })
    async list() {
        return ['foo1', 'foo2', 'foo3'];
    }

    @Post({
        path: '/foo',
        requestBodySchema: {
            type: 'object',
            properties: {
                fooId: { type: 'string', minLength: 1, format: 'uuid' },
            },
            required: ['fooId']
        },
        responses: {
            200: { contentType: 'application/json' }
        }
    })
    async create() {
        this.ctx.status = 201;
        const { fooId } = this.ctx.request.body;
        return { fooId };
    }

    @Get({ path: '/foo-error' })
    async throwError() {
        throw new Exception();
    }

    @Get({ path: '/foo/{fooId}' })
    async get(
    @PathParam('fooId', { schema: { type: 'string' } })
        fooId: string
    ) {
        return { fooId };
    }

    @Put({
        path: '/foo/{fooId}',
        responses: {
            200: { contentType: 'application/json' }
        }
    })
    async update(
    @PathParam('fooId', { schema: { type: 'string' } })
        fooId: string,
        @BodyParam('bar', { schema: { type: 'string' } })
        bar: string
    ) {
        return { fooId, bar };
    }

}
