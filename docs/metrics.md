## Metrics

Framework provides a standard facility to collect and expose Prometheus metrics.

Following main use cases are supported:

1. Application-specific counters, gauges and histograms
2. Global metrics

### App-specific metrics

Create a `Metrics` class in `src/main/metrics.ts` and define your counters, histograms and gauges.

```ts
import { MetricsRegistry } from '@ubio/framework';
import { injectable } from 'inversify';

@injectable()
export class Metrics extends MetricsRegistry {

    dataCacheKeysRequested = this.counter('api_dataset_cache_keys_requested_total',
        'Data Cache: Keys Requested');
    dataCacheKeysRetrieved = this.counter('api_dataset_cache_keys_retrieved_total',
        'Data Cache: Keys Retrieved');
    dataCacheKeysStored = this.counter('api_dataset_cache_keys_stored_total',
        'Data Cache: Keys Stored');

}
```

In composition root, use `bindMetrics` method to register it.

```ts
export class App extends Application {
    constructor() {
        super();
        // ...
        this.bindMetrics(Metrics);
    }
}
```

This will do two things:

1. bind `Metrics` to self in singleton scope
2. bind that instance to `MetricsRegistry` which is used to aggregate mutliple registries (including the global registry)

Finally, for observing the metrics in your classes, simply `@inject(Metric)` and start using the counters, gauges and histograms you have defined.

### Global metrics

Global metrics are collected in `GlobalMetricsRegistry` which is automatically bound to all applications (you don't have to specify anything).

Global metrics include `@MeasureAsync` decorator which can be used to annotate any Promise-returning method so that its performance can be reported and analyse.

```ts
class MyClass {
    @MeasureAsync()
    async doWork() {

    }
}

```

In this example, `app_method_latencies_seconds{class="MyClass",method="doWork"}` histogram will be reported.

### Metrics endpoint

MetricsRouter is automatically bound to all applications (you don't have to do anything). It serves `GET /metrics` endpoint and reports metrics from all registered registries.
