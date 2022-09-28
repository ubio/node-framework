import { injectable, multiInject } from 'inversify';

import { Get, Router } from '../router.js';
import { MetricsRegistry } from './registry.js';

@injectable()
export class MetricsRouter extends Router {

    constructor(
        @multiInject(MetricsRegistry)
        protected registries: MetricsRegistry[]
    ) {
        super();
    }

    @Get({
        path: '/metrics',
        summary: '(internal) Get current process metrics',
        responses: {
            200: {
                description: 'Prometheus metrics in text-based format',
                contentType: 'text/plain',
            }
        }
    })
    async metrics() {
        this.ctx.type = 'text/plain; version=0.0.4';
        return this.registries.map(_ => _.report()).join('\n\n');
    }

}
