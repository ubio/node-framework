export interface MetricLabels {
    [name: string]: string | number;
}

export interface MetricDatum<L extends MetricLabels> {
    labels: Partial<L>;
    timestamp?: number;
    value: number;
}

export abstract class Metric<L extends MetricLabels = MetricLabels> {

    constructor(
        public name: string,
        public help: string,
    ) {
    }

    abstract getType(): string;

    protected abstract generateReportLines(): Iterable<string>;

    getMetricLineName(labels: Partial<L>, suffix: string = '') {
        const fields = this.createMetricLabelsKey(labels);
        return fields ? `${this.name}${suffix}{${fields}}` : this.name;
    }

    report() {
        const report = [];
        report.push(`# HELP ${this.name} ${this.help}`);
        report.push(`# TYPE ${this.name} ${this.getType()}`);
        report.push(...this.generateReportLines());
        return report.join('\n');
    }

    protected createMetricLabelsKey<L extends MetricLabels>(labels: Partial<L> = {}) {
        return Object.keys(labels).sort().map(k => `${k}="${labels[k]}"`).join(',');
    }

}
