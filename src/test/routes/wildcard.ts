import { Get, Middleware, PathParam, Router } from '../../main/index.js';

export class WildcardRouter extends Router {

    @Middleware()
    async beforeAll() {
        this.ctx.set('wildcard-before-all', 'true');
    }

    @Get({ path: '/path/{*path}' })
    async getSplat(
        @PathParam('path', { schema: { type: 'string' } })
        path: string
    ) {
        return { path };
    }

}
