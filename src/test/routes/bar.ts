import { Router, Get, Middleware, QueryParam } from '../../main';

export class BarRouter extends Router {

    @Middleware()
    async beforeAll() {
        this.ctx.set('bar-before-all', 'true');
    }

    @Get({ path: '/bar' })
    async list(
        @QueryParam('sort', { schema: { type: 'string', default: '+name' } })
        sort: string,
        @QueryParam('limit', { schema: { type: 'number', default: 100, minimum: 0, maximum: 1000 } })
        limit: number,
        @QueryParam('offset', { schema: { type: 'number', default: 0, minimum: 0 } })
        offset: number,
    ) {
        return { sort, limit, offset };
    }
}
