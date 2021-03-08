import { Metric } from './metric';
import { createMetricLabelsKey, MetricDatum, MetricLabels } from './util';

export class GaugeMetric extends Metric {
    protected data: Map<string, MetricDatum> = new Map();

    getType() {
        return 'gauge';
    }

    *generateReportLines() {
        for (const datum of this.data.values()) {
            yield [
                this.getMetricLineName(datum.labels),
                datum.value,
                datum.timestamp,
            ].join(' ');
        }
    }

    get(labels: MetricLabels = {}) {
        return this.data.get(createMetricLabelsKey(labels));
    }

    set(value: number, labels: MetricLabels = {}, timestamp: number = Date.now()) {
        const key = createMetricLabelsKey(labels);
        const datum = this.data.get(key);
        if (datum) {
            datum.value = value;
            datum.timestamp = timestamp;
        } else {
            this.data.set(key, {
                value,
                timestamp,
                labels,
            });
        }
    }

}
