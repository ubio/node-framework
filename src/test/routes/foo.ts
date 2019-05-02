import { Router, Get, PathParam, Middleware, Post, BodyParam } from '../../main';

export class FooRouter extends Router {

    @Middleware()
    async beforeAll() {
        this.ctx.set('foo-before-all', 'true');
    }

    @Middleware({ path: '/foo/{fooId}' })
    async beforeGetOne(
        @PathParam('fooId', { required: true, schema: { type: 'string' } })
        fooId: string
    ) {
        this.ctx.set('foo-before-get-one', fooId);
    }

    @Get({
        path: '/foo',
        responses: {
            200: { schema: { type: 'array', items: { type: 'string' } } }
        }
    })
    async list() {
        return [ 'foo1', 'foo2', 'foo3' ];
    }

    @Post({
        path: '/foo',
        responses: {
            200: { contentType: 'text' }
        }
    })
    async create(
        @BodyParam('fooId', { required: true, schema: { type: 'string', minLength: 1 } })
        fooId: string
    ) {
        this.ctx.status = 201;
        return { fooId };
    }

    @Get({ path: '/foo/{fooId}' })
    async get(
        @PathParam('fooId', { required: true, schema: { type: 'string' } })
        fooId: string
    ) {
        return { fooId };
    }
}
