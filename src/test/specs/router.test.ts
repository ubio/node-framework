import assert from 'assert';
import { Config, ProcessEnvConfig } from 'mesh-config';
import supertest from 'supertest';

import { Application } from '../../main/index.js';
import { BarRouter } from '../routes/bar.js';
import { FooRouter } from '../routes/foo.js';
import { MultipartRouter } from '../routes/multipart.js';
import { ResponseSchemaRouter } from '../routes/response-schema.js';
import { WildcardRouter } from '../routes/wildcard.js';

describe('Router', () => {

    describe('request dispatching', () => {

        class App extends Application {

            override createHttpRequestScope() {
                const mesh = super.createHttpRequestScope();
                mesh.service(FooRouter);
                mesh.service(BarRouter);
                mesh.service(WildcardRouter);
                mesh.service(MultipartRouter);
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

        it('GET /foo', async () => {
            const request = supertest(app.httpServer.callback());
            const res = await request.get('/foo');
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.header['foo-before-all'], 'true');
            assert.strictEqual(res.header['foo-before-not-create-or-update'], 'true');
            assert(res.header['bar-before-all'] == null);
            assert(res.header['foo-before-get-one'] == null);
            assert.deepStrictEqual(res.body, ['foo1', 'foo2', 'foo3']);
        });

        it('POST /foo', async () => {
            const fooId = '00000000-0000-0000-0000-000000000000';
            const request = supertest(app.httpServer.callback());
            const res = await request.post('/foo').send({ fooId });

            assert.strictEqual(res.status, 201);
            assert.strictEqual(res.header['foo-before-all'], 'true');
            assert.strictEqual(res.header['foo-before-not-create-or-update'], 'true');
            assert(res.header['bar-before-all'] == null);
            assert(res.header['foo-before-get-one'] == null);
            assert.deepStrictEqual(res.body, { fooId });
        });

        it('POST /foo with missing params', async () => {
            const request = supertest(app.httpServer.callback());
            const res = await request.post('/foo')
                .send({});
            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.header['foo-before-all'], 'true');
            assert(res.header['bar-before-all'] == null);
            assert(res.header['foo-before-get-one'] == null);
            assert.deepStrictEqual(res.body.name, 'RequestParametersValidationError');
        });

        it('POST /foo with incorrect params', async () => {
            const request = supertest(app.httpServer.callback());
            const res = await request.post('/foo')
                .send({ fooId: 'blah' });
            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.header['foo-before-all'], 'true');
            assert(res.header['bar-before-all'] == null);
            assert(res.header['foo-before-get-one'] == null);
            assert.deepStrictEqual(res.body.name, 'RequestParametersValidationError');
        });

        it('GET /foo/{fooId}', async () => {
            const request = supertest(app.httpServer.callback());
            const res = await request.get('/foo/123');
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.header['foo-before-all'], 'true');
            assert.strictEqual(res.header['foo-before-get-one'], '123');
            assert(res.header['bar-before-all'] == null);
            assert.deepStrictEqual(res.body, { fooId: '123' });
        });

        it('GET /foo/{fooId}', async () => {
            const request = supertest(app.httpServer.callback());
            const res = await request.get('/foo/123');
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.header['foo-before-all'], 'true');
            assert.strictEqual(res.header['foo-before-get-one'], '123');
            assert(res.header['foo-before-not-create-or-update'] == null);
            assert(res.header['foo-after-not-create-or-update'] == null);
            assert(res.header['bar-before-all'] == null);
            assert.deepStrictEqual(res.body, { fooId: '123' });
        });

        it('PUT /foo/{fooId}', async () => {
            const request = supertest(app.httpServer.callback());
            const res = await request.put('/foo/123')
                .send({ bar: 'hello' });
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.header['foo-before-all'], 'true');
            assert.strictEqual(res.header['foo-before-get-one'], '123');
            assert(res.header['foo-before-not-create-or-update'] == null);
            assert(res.header['foo-after-not-create-or-update'] == null);
            assert(res.header['bar-before-all'] == null);
            assert.deepStrictEqual(res.body, { fooId: '123', bar: 'hello' });
        });

        it('GET /bar with default parameters', async () => {
            const request = supertest(app.httpServer.callback());
            const res = await request.get('/bar');
            assert.strictEqual(res.status, 200);
            assert(res.header['bar-before-all'], 'true');
            assert(res.header['foo-before-all'] == null);
            assert(res.header['foo-before-get-one'] == null);
            assert.deepStrictEqual(res.body, { sort: '+name', limit: 100, offset: 0 });
        });

        it('GET /bar with parameter overrides', async () => {
            const request = supertest(app.httpServer.callback());
            const res = await request.get('/bar?sort=-name&limit=1000&offset=50');
            assert.strictEqual(res.status, 200);
            assert(res.header['bar-before-all'], 'true');
            assert(res.header['foo-before-all'] == null);
            assert(res.header['foo-before-get-one'] == null);
            assert.deepStrictEqual(res.body, { sort: '-name', limit: 1000, offset: 50 });
        });

        it('GET /bar with invalid overrides', async () => {
            const request = supertest(app.httpServer.callback());
            const res = await request.get('/bar?limit=1001');
            assert.strictEqual(res.status, 400);
            assert(res.header['bar-before-all'], 'true');
            assert(res.header['foo-before-all'] == null);
            assert(res.header['foo-before-get-one'] == null);
            assert.deepStrictEqual(res.body.name, 'RequestParametersValidationError');
        });

        it('GET /bar with extraneous parameters', async () => {
            const request = supertest(app.httpServer.callback());
            const res = await request.get('/bar?blah=true&bleu=false');
            assert.strictEqual(res.status, 200);
            assert(res.header['bar-before-all'], 'true');
            assert(res.header['foo-before-all'] == null);
            assert(res.header['foo-before-get-one'] == null);
            assert.deepStrictEqual(res.body, { sort: '+name', limit: 100, offset: 0 });
        });

        it('POST /bar validates body', async () => {
            const request = supertest(app.httpServer.callback());
            const res = await request.post('/bar')
                .send({ invalid: true });
            assert.strictEqual(res.status, 400);
            assert.strictEqual(res.body.name, 'RequestParametersValidationError');
        });

        it('GET /path/1/2/3', async () => {
            const request = supertest(app.httpServer.callback());
            const res = await request.get('/path/1/2/3');
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.header['wildcard-before-all'], 'true');
            assert(res.header['bar-before-all'] == null);
            assert(res.header['foo-before-get-one'] == null);
            assert.deepStrictEqual(res.body, { path: '1/2/3' });
        });

        it('GET /foo-error error is hidden by after hook', async () => {
            const request = supertest(app.httpServer.callback());
            const res = await request.get('/foo-error');
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.header['foo-after-all'], 'true');
            assert.strictEqual(res.header['foo-after-not-create-or-update'], 'true');
            assert.strictEqual(res.header['foo-after-hide-error'], 'true');
        });

        describe('multipart body', () => {

            it('POST /upload works with multipart requests', async () => {
                const request = supertest(app.httpServer.callback());
                const res = await request.post('/upload')
                    .field('foo', 'hello')
                    .attach('myFile', Buffer.from('some file content', 'utf-8'), {
                        filename: 'file.txt'
                    });
                assert.strictEqual(res.status, 200);
                assert.strictEqual(res.body.foo, 'hello');
                assert.strictEqual(res.body.fileSize, 17);
            });

        });

    });

    describe('response validation', () => {

        class App extends Application {

            override createHttpRequestScope() {
                const mesh = super.createHttpRequestScope();
                mesh.service(ResponseSchemaRouter);
                mesh.service(Config, class extends ProcessEnvConfig {
                    constructor() {
                        super();
                        this.map.set('HTTP_VALIDATE_RESPONSES', 'true');
                    }
                });
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

        it('does not throw if response is valid', async () => {
            const request = supertest(app.httpServer.callback());
            const res = await request.get('/valid');
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.number, 1);
            assert.strictEqual(res.body.string, 'one');
        });

        it('does not throw if response schema is missing', async () => {
            const request = supertest(app.httpServer.callback());
            const res = await request.get('/missing');
            assert.strictEqual(res.status, 200);
            assert.strictEqual(res.body.number, 1);
            assert.strictEqual(res.body.string, 'one');
        });

        it('throws if response is invalid', async () => {
            const request = supertest(app.httpServer.callback());
            const res = await request.get('/invalid');
            assert.strictEqual(res.status, 500);
        });

    });

});
