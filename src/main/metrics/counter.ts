import { Metric } from './metric';
import { createMetricLabelsKey, MetricDatum, MetricLabels } from './util';

export class CounterMetric extends Metric {
    protected data: Map<string, MetricDatum> = new Map();

    getType() {
        return 'counter';
    }

    get(labels: MetricLabels = {}) {
        return this.data.get(createMetricLabelsKey(labels));
    }

    incr(value: number = 1, labels: MetricLabels = {}, timestamp?: number) {
        const key = createMetricLabelsKey(labels);
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
