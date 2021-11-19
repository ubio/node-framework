import { Request } from '@automationcloud/request';
import { inject, injectable, multiInject } from 'inversify';

import { Config, config } from '../config';
import { Logger } from '../logger';
import * as util from '../util';
import { Metric } from './metric';
import { MetricsRegistry } from './registry';

@injectable()
export class MetricsPushGateway {
    constructor(
        @multiInject(MetricsRegistry)
        protected registries: MetricsRegistry[],
        @inject(Config)
        public config: Config,
        @inject(Logger)
        public logger: Logger,
    ) {
    }

    @config({ default: 'http://push-gateway.monitoring.svc.cluster.local:9091/metrics' })
    PUSH_GATEWAY_URL!: string;

    async push(metric: Metric) {
        const payload = metric.report();
        await this.pushMetrics(payload);
    }

    async pushAll() {
        const payload = this.registries.map(_ => _.report()).join('\n\n');
        await this.pushMetrics(payload);
    }

    protected async pushMetrics(payload: string) {
        const { name: job } = await util.getAppDetails();
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
