import { Metric, MetricDatum, MetricLabels } from './metric';

export class GaugeMetric<L extends MetricLabels = MetricLabels> extends Metric<L> {
    protected data: Map<string, MetricDatum<L>> = new Map();

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
        return this.data.get(this.createMetricLabelsKey(labels));
    }

    set(value: number, labels: Partial<L> = {}, timestamp: number = Date.now()) {
        const key = this.createMetricLabelsKey(labels);
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
