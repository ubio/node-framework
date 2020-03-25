import { injectable } from 'inversify';
import { Metric } from './metric';
import { CounterMetric } from './counter';
import { GaugeMetric } from './gauge';
import { HistogramMetric } from './histogram';
import { Exception } from '../exception';

@injectable()
export class MetricsRegistry {
    protected registry: Map<string, Metric> = new Map();

    counter(name: string, help: string) {
        const counter = new CounterMetric(name, help);
        this.register(counter);
        return counter;
    }

    gauge(name: string, help: string) {
        const gauge = new GaugeMetric(name, help);
        this.register(gauge);
        return gauge;
    }

    histogram(name: string, help: string, buckets?: number[]) {
        const histogram = new HistogramMetric(name, help, buckets);
        this.register(histogram);
        return histogram;
    }

    protected register(metric: Metric) {
        // It is prohibited to register a metric with same name twice
        const existing = this.registry.get(metric.name);
        if (existing) {
            throw new Exception({
                name: 'MetricAlreadyDefined',
                message: `Metric ${name} is already defined; please store a reference to a metric instance`
            });
        }
        this.registry.set(metric.name, metric);
    }

    report() {
        return [...this.registry.values()].map(_ => _.report()).join('\n\n');
    }

}
