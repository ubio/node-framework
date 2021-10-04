import assert from 'assert';
import supertest from 'supertest';

import { Application, Config, DefaultConfig, matchPath, Router, tokenizePath } from '../../main';
import { BarRouter } from '../routes/bar';
import { FooRouter } from '../routes/foo';
import { MultipartRouter } from '../routes/multipart';
import { ResponseSchemaRouter } from '../routes/response-schema';
import { WildcardRouter } from '../routes/wildcard';

describe('Router', () => {

    describe('tokenizePath', () => {

        it('parses /', () => {
            const tokens = tokenizePath('/');
            assert.deepStrictEqual(tokens, [
                { type: 'string', value: '/' }
            ]);
        });

        it('parses /hello/world', () => {
            const tokens = tokenizePath('/hello/world');
            assert.deepStrictEqual(tokens, [
                { type: 'string', value: '/hello/world' }
            ]);
        });

        it('parses /foo/{fooId}', () => {
            const tokens = tokenizePath('/foo/{fooId}');
            assert.deepStrictEqual(tokens, [
                { type: 'string', value: '/foo/' },
                { type: 'param', value: 'fooId', wildcard: false },
            ]);
        });

        it('parses /foo/{fooId}/bar/{barId}', () => {
            const tokens = tokenizePath('/foo/{fooId}/bar/{barId}');
            assert.deepStrictEqual(tokens, [
                { type: 'string', value: '/foo/' },
                { type: 'param', value: 'fooId', wildcard: false },
                { type: 'string', value: '/bar/' },
                { type: 'param', value: 'barId', wildcard: false },
            ]);
        });

        it('parses /foo/{fooId}/bar/{barId}.{ext}', () => {
            const tokens = tokenizePath('/foo/{fooId}/bar/{barId}.{ext}');
            assert.deepStrictEqual(tokens, [
                { type: 'string', value: '/foo/' },
                { type: 'param', value: 'fooId', wildcard: false },
                { type: 'string', value: '/bar/' },
                { type: 'param', value: 'barId', wildcard: false },
                { type: 'string', value: '.' },
                { type: 'param', value: 'ext', wildcard: false },
            ]);
        });

    });

    describe('matchPath', () => {
        describe('/hello/world', () => {
            const tokens = tokenizePath('/hello/world');
            it('match whole', () => {
                const m = matchPath('/hello/world', tokens);
                assert.deepStrictEqual(m, {});
            });
            it('match start', () => {
                const m = matchPath('/hello/world/blah', tokens, true);
                assert.deepStrictEqual(m, {});
            });
            it('no match', () => {
                const m1 = matchPath('/hello/wrld', tokens);
                assert.deepStrictEqual(m1, null);
                const m2 = matchPath('/hello/world/123', tokens);
                assert.deepStrictEqual(m2, null);
            });
            it('match trailing "/"', () => {
                const m = matchPath('/hello/world/', tokens);
                assert.deepStrictEqual(m, {});
            });
        });

        describe('/hello/world/', () => {
            const tokens = tokenizePath('/hello/world/');
            it('match whole', () => {
                const m = matchPath('/hello/world/', tokens);
                assert.deepStrictEqual(m, {});
            });
            it('match start', () => {
                const m = matchPath('/hello/world/blah', tokens, true);
                assert.deepStrictEqual(m, {});
            });
            it('no match', () => {
                const m1 = matchPath('/hello/wrld', tokens);
                assert.deepStrictEqual(m1, null);
                const m2 = matchPath('/hello/world/123', tokens);
                assert.deepStrictEqual(m2, null);
            });
            it('no match lack of trailing slash', () => {
                const m = matchPath('/hello/world', tokens);
                assert.deepStrictEqual(m, null);
            });
        });


        describe('/foo/{fooId}/bar/{barId}', () => {
            const tokens = tokenizePath('/foo/{fooId}/bar/{barId}');
            it('match whole', () => {
                const m = matchPath('/foo/123/bar/345', tokens);
                assert.deepStrictEqual(m, { fooId: '123', barId: '345' });
            });
            it('match start', () => {
                const m = matchPath('/foo/123/bar/345/baz', tokens, true);
                assert.deepStrictEqual(m, { fooId: '123', barId: '345' });
            });
            it('match special characters', () => {
                const m = matchPath('/foo/123:456/bar/345:789/baz', tokens, true);
                assert.deepStrictEqual(m, { fooId: '123:456', barId: '345:789' });
            });
            it('no match', () => {
                const m = matchPath('/foo/123/bar/345/baz', tokens);
                assert.deepStrictEqual(m, null);
            });
        });

        describe('/{filename}.{ext}', () => {
            const tokens = tokenizePath('/{filename}.{ext}');
            it('match whole', () => {
                const m = matchPath('/document.pdf', tokens);
                assert.deepStrictEqual(m, { filename: 'document', ext: 'pdf' });
            });
            it('match start', () => {
                const m = matchPath('/document.pdf/123', tokens, true);
                assert.deepStrictEqual(m, { filename: 'document', ext: 'pdf' });
            });
            it('no match', () => {
                const m1 = matchPath('/document.pdf/123', tokens);
                assert.deepStrictEqual(m1, null);
            });
        });

        describe('/tags/{*tags}', () => {
            const tokens = tokenizePath('/tags/{*tags}');
            it('match all path components', () => {
                const m = matchPath('/tags/1/2/3', tokens);
                assert.deepStrictEqual(m, { tags: '1/2/3' });
            });
        });

    });

    describe('request dispatching', () => {

        class App extends Application {
            constructor() {
                super();
                this.container.bind(Router).to(FooRouter);
                this.container.bind(Router).to(BarRouter);
                this.container.bind(Router).to(WildcardRouter);
                this.container.bind(Router).to(MultipartRouter);
            }
            async beforeStart() {
                await this.httpServer.startServer();
            }
            async afterStop() {
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
            constructor() {
                super();
                this.container.bind(Router).to(ResponseSchemaRouter);
                this.container.rebind(Config).to(class extends DefaultConfig {
                    constructor() {
                        super();
                        this.map.set('HTTP_VALIDATE_RESPONSES', 'true');
                    }
                });
            }
            async beforeStart() {
                await this.httpServer.startServer();
            }
            async afterStop() {
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
