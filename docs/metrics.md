## Metrics

Framework provides (global) standard metrics and that can be extended with `@nodescript/metrics`, to collect and expose Prometheus metrics.

Following main use cases are supported:

1. Application-specific counters, gauges and histograms
2. Global metrics

### App-specific metrics

Create a `Metrics` class in `src/main/metrics.ts` and define your counters, histograms and gauges.

```ts
import { metric, CounterMetric } from '@nodescript/metrics';

export class Metrics {

    @metric() dataCacheKeysRequested = new CounterMetric('api_dataset_cache_keys_requested_total',
        'Data Cache: Keys Requested');
    @metric() dataCacheKeysRetrieved = new CounterMetric('api_dataset_cache_keys_retrieved_total',
        'Data Cache: Keys Retrieved');
    @metric() dataCacheKeysStored = new CounterMetric('api_dataset_cache_keys_stored_total',
        'Data Cache: Keys Stored');

}
```

In composition root, use bind the metrics to global scope.

```ts
export class App extends Application {

    override createGlobalScope() {
        const mesh = super.createGlobalScope();
        // ...
        mesh.service(Metrics);
        return mesh;
    }
}
```

This will do two things:

1. bind `Metrics` to self in singleton scope
2. make it available to `@nodescript/metrics` so the app can expose the reports over http.

Finally, for observing the metrics in your classes, simply `@dep() metrics: Metrics` and start using the counters, gauges and histograms you have defined.

### Global metrics

Global metrics are collected in `GlobalMetrics` which is automatically bound to all applications (you don't have to specify anything).

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

By default, the application will run a http server (in a different port) that handles requests to `GET /metrics` endpoint, unless configured otherwise (i.e. `START_AUX_HTTP_ON_START=false` is set). So, you don't have to do anything to expose the metrics reports.

This endpoint reports metrics from all registered ones, which are:

- class member decorated with `@metric()`;
- metric type instantiated (i.e. `new CounterMetric()`);
- and its class is bound to mesh container as a service (i.e `mesh.service(Metrics)`).
