import { Request } from '@automationcloud/request';
import { config } from '@flexent/config';
import { Logger } from '@flexent/logger';
import { dep, Mesh } from '@flexent/mesh';

import { findMeshInstances, getAppDetails } from '../util.js';
import { Metric } from './metric.js';
import { MetricsRegistry } from './registry.js';

export class MetricsPushGateway {

    @config({ default: 'http://push-gateway.monitoring.svc.cluster.local:9091/metrics' })
    PUSH_GATEWAY_URL!: string;

    @dep() protected mesh!: Mesh;
    @dep() protected logger!: Logger;

    getRegistries(): MetricsRegistry[] {
        return findMeshInstances(this.mesh, MetricsRegistry);
    }

    async push(metric: Metric) {
        const payload = metric.report();
        await this.pushMetrics(payload);
    }

    async pushAll() {
        const payload = this.getRegistries().map(_ => _.report()).join('\n\n');
        await this.pushMetrics(payload);
    }

    protected async pushMetrics(payload: string) {
        const { name: job } = await getAppDetails();
        const request = new Request({
            baseUrl: this.PUSH_GATEWAY_URL,
        });
        const path = `/job/${job}`;
        try {
            await request.send('post', path, {
                body: payload + '\n',
            });
        } catch (error: any) {
            const response = error.response ? await error.response.text() : 'No response information found';
            this.logger.error('Push gateway failed', {
                error,
                response,
            });
        }
    }
}
