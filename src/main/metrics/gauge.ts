import { MetricLabels, MetricDatum, createLabelsKey } from './util';
import { Metric } from './metric';

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
        return this.data.get(createLabelsKey(labels));
    }

    set(value: number, labels: MetricLabels = {}, timestamp: number = Date.now()) {
        const key = createLabelsKey(labels);
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
