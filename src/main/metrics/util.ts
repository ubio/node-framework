export interface MetricLabels {
    [name: string]: string;
}

export interface MetricDatum {
    labels: MetricLabels;
    timestamp: number;
    value: number;
}

export function createLabelsKey(labels: MetricLabels) {
    return Object.keys(labels).sort().map(k => `${k}="${labels[k]}"`).join(',');
}
