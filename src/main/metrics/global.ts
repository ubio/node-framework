import { CounterMetric, GaugeMetric, HistogramMetric, metric } from '@nodescript/metrics';

const METRICS_GLOBAL_KEY = Symbol.for('@ubio/framework:globalMetrics');

export class GlobalMetricsRegistry {
    @metric() methodDuration = new HistogramMetric('app_method_duration_seconds',
        'Performance measurements taken for a particular class method');
    @metric() handlerDuration = new HistogramMetric('app_handler_duration_seconds',
        'Application performance measurements');
    @metric() mongoDocumentsTotal = new GaugeMetric('mongo_documents_total',
        'Estimated count of MongoDB documents, per collection');
    @metric() appLogsTotal = new CounterMetric('app_logs_total',
        'Total count of log lines by severity');
}

export function getGlobalMetrics(): GlobalMetricsRegistry {
    let registry = (global as any)[METRICS_GLOBAL_KEY];
    if (!(registry instanceof GlobalMetricsRegistry)) {
        registry = new GlobalMetricsRegistry();
        (global as any)[METRICS_GLOBAL_KEY] = registry;
    }
    return registry;
}

export function MeasureAsync() {
    return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
        const globalMetrics = getGlobalMetrics();
        const originalMethod = descriptor.value;
        descriptor.value = async function (this: any): Promise<any> {
            const end = globalMetrics.methodDuration.timer({
                class: target.constructor.name,
                method: propertyKey,
            });
            try {
                // eslint-disable-next-line prefer-rest-params
                return await originalMethod.apply(this, arguments);
            } finally {
                end();
            }
        };
    };
}
