import { Metric } from './metric.js';

const DEFAULT_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

export class HistogramMetric<L = any> extends Metric<L> {
    protected buckets: number[];
    data: Map<string, HistogramDatum<L>> = new Map();

    constructor(
        name: string,
        help: string,
        buckets: number[] = DEFAULT_BUCKETS,
    ) {
        super(name, help);
        this.buckets = buckets.slice().sort((a, b) => a > b ? 1 : -1);
    }

    getType() {
        return 'histogram';
    }

    add(value: number, labels: Partial<L> = {}, timestamp: number = Date.now()) {
        const key = this.createMetricLabelsKey(labels);
        const datum = this.data.get(key);
        if (datum) {
            datum.timestamp = timestamp;
            datum.buckets = this.calcBuckets(datum.buckets, value);
            datum.count += 1;
            datum.sum += value;
        } else {
            this.data.set(key, {
                labels,
                timestamp,
                buckets: this.calcBuckets([], value),
                count: 1,
                sum: value,
            });
        }
    }

    timer(labels: Partial<L> = {}) {
        const startedAt = process.hrtime();
        return () => {
            const [sec, nanosec] = process.hrtime(startedAt);
            const value = sec + nanosec * 1e-9;
            this.add(value, labels);
        };
    }

    async measure<T>(fn: () => Promise<T>, labels: Partial<L> = {}): Promise<T> {
        const stop = this.timer(labels);
        try {
            return await fn();
        } finally {
            stop();
        }
    }

    protected calcBuckets(existingValues: number[], newValue: number) {
        return this.buckets
            .map(n => newValue <= n ? 1 : 0)
            .map((incr, index) => {
                return incr + (existingValues[index] || 0);
            });
    }

    protected *generateReportLines() {
        for (const datum of this.data.values()) {
            for (const [i, le] of this.buckets.entries()) {
                const prefix = this.getMetricLineName({ ...datum.labels, le: String(le) }, '_bucket');
                const sample = datum.buckets[i];
                yield [prefix, sample].join(' ');
            }
            yield [
                this.getMetricLineName({ ...datum.labels, le: '+Inf' }, '_bucket'),
                datum.count
            ].join(' ');
            yield [
                this.getMetricLineName(datum.labels, '_sum'),
                datum.sum
            ].join(' ');
            yield [
                this.getMetricLineName(datum.labels, '_count'),
                datum.count
            ].join(' ');
        }
    }

}

export interface HistogramDatum<L> {
    labels: Partial<L>;
    timestamp: number;
    buckets: number[]; // correspond to configured buckets, w/o +Inf
    count: number;
    sum: number;
}
