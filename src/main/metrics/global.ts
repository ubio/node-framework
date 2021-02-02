import { MetricsRegistry } from './registry';

const METRICS_GLOBAL_KEY = Symbol.for('@ubio/framework:globalMetrics');

export class GlobalMetricsRegistry extends MetricsRegistry {
    methodDuration = this.histogram('app_method_duration_seconds',
        'Performance measurements taken for a particular class method');
    handlerDuration = this.histogram('app_handler_duration_seconds',
        'Application performance measurements');
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
        // tslint:disable-next-line only-arrow-functions
        descriptor.value = async function(this: any): Promise<any> {
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
