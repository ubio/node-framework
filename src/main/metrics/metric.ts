import { createMetricLabelsKey, MetricLabels } from './util';

export abstract class Metric {

    constructor(
        public name: string,
        public help: string,
    ) {
    }

    abstract getType(): string;

    protected abstract generateReportLines(): Iterable<string>;

    getMetricLineName(labels: MetricLabels, suffix: string = '') {
        const fields = createMetricLabelsKey(labels);
        return fields ? `${this.name}${suffix}{${fields}}` : this.name;
    }

    report() {
        const report = [];
        report.push(`# HELP ${this.name} ${this.help}`);
        report.push(`# TYPE ${this.name} ${this.getType()}`);
        report.push(...this.generateReportLines());
        return report.join('\n');
    }

}
