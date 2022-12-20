import { dep } from 'mesh-ioc';

import { AcAuth, Get, Router } from '../../main/index.js';

export class AccessRouter extends Router {

    @dep() protected auth!: AcAuth;

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
