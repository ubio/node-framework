import { dep, Mesh } from '@flexent/mesh';

import { Get, Router } from '../router.js';
import { findMeshInstances } from '../util.js';
import { MetricsRegistry } from './registry.js';

export class MetricsRouter extends Router {

    @dep() protected mesh!: Mesh;

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
        return this.getRegistries().map(_ => _.report()).join('\n\n');
    }

    protected getRegistries(): MetricsRegistry[] {
        return findMeshInstances(this.mesh, MetricsRegistry);
    }

}
