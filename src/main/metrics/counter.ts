import { Metric, MetricDatum } from './metric.js';

export class CounterMetric<L = any> extends Metric<L> {
    protected data: Map<string, MetricDatum<L>> = new Map();

    getType() {
        return 'counter';
    }

    get(labels: Partial<L> = {}) {
        return this.data.get(this.createMetricLabelsKey(labels));
    }

    incr(value: number = 1, labels: Partial<L> = {}, timestamp?: number) {
        const key = this.createMetricLabelsKey(labels);
        const datum = this.data.get(key);
        if (datum) {
            datum.value += value;
            datum.timestamp = timestamp;
        } else {
            this.data.set(key, {
                value,
                timestamp,
                labels,
            });
        }
    }

    *generateReportLines() {
        for (const datum of this.data.values()) {
            yield [
                this.getMetricLineName(datum.labels),
                datum.value,
                datum.timestamp,
            ].filter(x => x != null).join(' ');
        }
    }

}
