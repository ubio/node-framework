import assert from 'assert';
import theredoc from 'theredoc';

import { CounterMetric, GaugeMetric, HistogramMetric } from '../../main';

describe('CounterMetric', () => {

    it('increments an new counter', () => {
        const counter = new CounterMetric('foo', 'Foo help');
        counter.incr(1, { foo: 'one' });
        const datum = counter.get({ foo: 'one' });
        assert.ok(datum);
        assert.equal(datum?.value, 1);
    });

    it('increments an existing counter', () => {
        const counter = new CounterMetric('foo', 'Foo help');
        counter.incr(1, { foo: 'one' });
        counter.incr(1, { foo: 'one' });
        const datum = counter.get({ foo: 'one' });
        assert.ok(datum);
        assert.equal(datum?.value, 2);
    });

    it('increments without labels', () => {
        const counter = new CounterMetric('foo', 'Foo help');
        counter.incr();
        const datum = counter.get();
        assert.ok(datum);
        assert.equal(datum?.value, 1);
    });

    it('compiles a report', () => {
        const counter = new CounterMetric('foo', 'Foo help');
        counter.incr(1, {}, 123123123);
        counter.incr(1, { lbl: 'one' }, 123123123);
        counter.incr(2, { lbl: 'two' });
        counter.incr(3, { lbl: 'three', foo: '1' }, 123123123);
        assert.equal(counter.report().trim(), theredoc`
            # HELP foo Foo help
            # TYPE foo counter
            foo 1 123123123
            foo{lbl="one"} 1 123123123
            foo{lbl="two"} 2
            foo{foo="1",lbl="three"} 3 123123123
        `.trim());
    });

});

describe('GaugeMetric', () => {

    it('sets a new value', () => {
        const gauge = new GaugeMetric('foo', 'Foo help');
        gauge.set(1, { foo: 'one' });
        const datum = gauge.get({ foo: 'one' });
        assert.ok(datum);
        assert.equal(datum?.value, 1);
    });

    it('overwrites a existing value', () => {
        const counter = new GaugeMetric('foo', 'Foo help');
        counter.set(2, { foo: 'one' });
        counter.set(5, { foo: 'one' });
        const datum = counter.get({ foo: 'one' });
        assert.ok(datum);
        assert.equal(datum?.value, 5);
    });

    it('sets without labels', () => {
        const counter = new GaugeMetric('foo', 'Foo help');
        counter.set(5);
        const datum = counter.get();
        assert.ok(datum);
        assert.equal(datum?.value, 5);
    });

    it('compiles a report', () => {
        const counter = new GaugeMetric('foo', 'Foo help');
        counter.set(1, {}, 123123123);
        counter.set(1, { lbl: 'one' }, 123123123);
        counter.set(2, { lbl: 'two' }, 123123123);
        counter.set(3, { lbl: 'three', foo: '1' }, 123123123);
        assert.equal(counter.report().trim(), theredoc`
            # HELP foo Foo help
            # TYPE foo gauge
            foo 1 123123123
            foo{lbl="one"} 1 123123123
            foo{lbl="two"} 2 123123123
            foo{foo="1",lbl="three"} 3 123123123
        `.trim());
    });

});

describe('HistogramMetric', () => {

    it('compiles a report', () => {
        const histogram = new HistogramMetric('foo', 'Foo help');
        histogram.add(0.16, { lbl: 'one' });
        histogram.add(0.15, { lbl: 'one' });
        histogram.add(0.24, { lbl: 'one' });
        histogram.add(0.11, { lbl: 'one' });
        histogram.add(0.55, { lbl: 'one' });

        histogram.add(0.1, { lbl: 'two' });
        histogram.add(0.6, { lbl: 'two' });
        histogram.add(0.9, { lbl: 'two' });
        histogram.add(1.0, { lbl: 'two' });
        histogram.add(1.05, { lbl: 'two' });
        histogram.add(2, { lbl: 'two' });
        histogram.add(3, { lbl: 'two' });

        assert.equal(histogram.report().trim(), theredoc`
            # HELP foo Foo help
            # TYPE foo histogram
            foo_bucket{lbl="one",le="0.005"} 0
            foo_bucket{lbl="one",le="0.01"} 0
            foo_bucket{lbl="one",le="0.025"} 0
            foo_bucket{lbl="one",le="0.05"} 0
            foo_bucket{lbl="one",le="0.1"} 0
            foo_bucket{lbl="one",le="0.25"} 4
            foo_bucket{lbl="one",le="0.5"} 4
            foo_bucket{lbl="one",le="1"} 5
            foo_bucket{lbl="one",le="2.5"} 5
            foo_bucket{lbl="one",le="5"} 5
            foo_bucket{lbl="one",le="10"} 5
            foo_bucket{lbl="one",le="+Inf"} 5
            foo_sum{lbl="one"} 1.21
            foo_count{lbl="one"} 5
            foo_bucket{lbl="two",le="0.005"} 0
            foo_bucket{lbl="two",le="0.01"} 0
            foo_bucket{lbl="two",le="0.025"} 0
            foo_bucket{lbl="two",le="0.05"} 0
            foo_bucket{lbl="two",le="0.1"} 1
            foo_bucket{lbl="two",le="0.25"} 1
            foo_bucket{lbl="two",le="0.5"} 1
            foo_bucket{lbl="two",le="1"} 4
            foo_bucket{lbl="two",le="2.5"} 6
            foo_bucket{lbl="two",le="5"} 7
            foo_bucket{lbl="two",le="10"} 7
            foo_bucket{lbl="two",le="+Inf"} 7
            foo_sum{lbl="two"} 8.65
            foo_count{lbl="two"} 7
        `.trim());
    });

});
