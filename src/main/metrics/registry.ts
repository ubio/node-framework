import { Exception } from '../exception.js';
import { CounterMetric } from './counter.js';
import { GaugeMetric } from './gauge.js';
import { HistogramMetric } from './histogram.js';
import { Metric } from './metric.js';

export class MetricsRegistry {
    protected registry: Map<string, Metric> = new Map();

    counter<L = any>(name: string, help: string) {
        const counter = new CounterMetric<L>(name, help);
        this.register(counter);
        return counter;
    }

    gauge<L = any>(name: string, help: string) {
        const gauge = new GaugeMetric<L>(name, help);
        this.register(gauge);
        return gauge;
    }

    histogram<L = any>(name: string, help: string, buckets?: number[]) {
        const histogram = new HistogramMetric<L>(name, help, buckets);
        this.register(histogram);
        return histogram;
    }

    protected register(metric: Metric) {
        // It is prohibited to register a metric with same name twice
        const existing = this.registry.get(metric.name);
        if (existing) {
            throw new MetricAlreadyDefined(metric.name);
        }
        this.registry.set(metric.name, metric);
    }

    report() {
        return [...this.registry.values()].map(_ => _.report()).join('\n\n');
    }
}

export class MetricAlreadyDefined extends Exception {
    constructor(metricName: string) {
        super(`Metric ${metricName} is already defined; please store a reference to a metric instance`);
    }
}
