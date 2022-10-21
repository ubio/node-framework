import { inject, injectable } from 'inversify';

import { AcAuth, Get, Router } from '../../main/index.js';

@injectable()
export class AccessRouter extends Router {
    constructor(
        @inject(AcAuth)
        protected auth: AcAuth,
    ) {
        super();
    }

    @Get({
        path: '/public',
        responses: {
            200: { schema: { type: 'array', items: { type: 'string' } } }
        }
    })
    async public() {
        return ['no', 'secret', 'here'];
    }

    @Get({
        path: '/secret',
        responses: {
            200: { schema: { type: 'array', items: { type: 'string' } } }
        }
    })
    async secrets() {
        this.auth.checkAuthenticated();
        return ['open', 'sesame'];
    }
}
