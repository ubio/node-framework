import { generateMetricsReport } from '@nodescript/metrics';
import assert from 'assert';
import supertest from 'supertest';

import { Application } from '../../main/index.js';
import { FooRouter } from '../routes/foo.js';

describe('Routes execution metrics', () => {

    class App extends Application {

        override createHttpRequestScope() {
            const mesh = super.createHttpRequestScope();
            mesh.service(FooRouter);
            return mesh;
        }

        override async beforeStart() {
            await this.httpServer.startServer();
        }

        override async afterStop() {
            await this.httpServer.stopServer();
        }

    }

    const app = new App();
    beforeEach(() => app.start());
    afterEach(() => app.stop());

    it('checks that the metric uses a route path template instead of an actual path with params', async () => {
        const request = supertest(app.httpServer.callback());

        await request.get('/foo/1');
        await request.get('/foo/2');

        const metricsReport = generateMetricsReport(app.mesh);

        assert.match(metricsReport, /path="\/foo\/{fooId}"/);
        assert.doesNotMatch(metricsReport, /path="\/foo\/1"/);
        assert.doesNotMatch(metricsReport, /path="\/foo\/2"/);
    });
});
