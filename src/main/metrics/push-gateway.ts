import { Request } from '@automationcloud/request';
import { inject, injectable, multiInject } from 'inversify';

import { Config, config } from '../config';
import { Logger } from '../logger';
import { MetricsRegistry } from './registry';

const DEFAULT_PUSH_GATE_URL = 'http://push-gateway.monitoring.svc.cluster.local:9091/metrics';
@injectable()
export class MetricsPushgateway {
    constructor(
        @multiInject(MetricsRegistry)
        protected registries: MetricsRegistry[],
        @inject(Config)
        public config: Config,
        @inject(Logger)
        public logger: Logger,
    ) {
    }

    @config({ default: DEFAULT_PUSH_GATE_URL }) PUSH_GATEWAY_URL!: string;

    async push(job: string) {
        const instance = process.env.HOSTNAME!;
        const request = new Request({
            baseUrl: this.PUSH_GATEWAY_URL,
        });
        const path = `/job/${job}/instance/${instance}`;
        const body = this.registries.map(_ => _.report()).join('\n\n') + '\n';
        try {
            await request.send('post', path, { body });
        } catch (error) {
            const response = await error.response.text();
            this.logger.error('Push gateway failed', {
                details: error,
                response,
            });
        }
    }

}
