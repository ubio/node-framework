import assert from 'assert';
import { tokenizePath, matchPath, Application, Router } from '../../main';
import { FooRouter } from '../routes/foo';
import { BarRouter } from '../routes/bar';
import supertest from 'supertest';
import { MultipartRouter } from '../routes/multipart';

describe('Router', () => {

    describe('tokenizePath', () => {

        it('parses /', () => {
            const tokens = tokenizePath('/');
            assert.deepEqual(tokens, [
                { type: 'string', value: '/' }
            ]);
        });

        it('parses /hello/world', () => {
            const tokens = tokenizePath('/hello/world');
            assert.deepEqual(tokens, [
                { type: 'string', value: '/hello/world' }
            ]);
        });

        it('parses /foo/{fooId}', () => {
            const tokens = tokenizePath('/foo/{fooId}');
            assert.deepEqual(tokens, [
                { type: 'string', value: '/foo/' },
                { type: 'param', value: 'fooId' },
            ]);
        });

        it('parses /foo/{fooId}/bar/{barId}', () => {
            const tokens = tokenizePath('/foo/{fooId}/bar/{barId}');
            assert.deepEqual(tokens, [
                { type: 'string', value: '/foo/' },
                { type: 'param', value: 'fooId' },
                { type: 'string', value: '/bar/' },
                { type: 'param', value: 'barId' },
            ]);
        });

        it('parses /foo/{fooId}/bar/{barId}.{ext}', () => {
            const tokens = tokenizePath('/foo/{fooId}/bar/{barId}.{ext}');
            assert.deepEqual(tokens, [
                { type: 'string', value: '/foo/' },
                { type: 'param', value: 'fooId' },
                { type: 'string', value: '/bar/' },
                { type: 'param', value: 'barId' },
                { type: 'string', value: '.' },
                { type: 'param', value: 'ext' },
            ]);
        });

    });

    describe('matchPath', () => {

        describe('/hello/world', () => {
            const tokens = tokenizePath('/hello/world');
            it('match whole', () => {
                const m = matchPath('/hello/world', tokens);
                assert.deepEqual(m, {});
            });
            it('match start', () => {
                const m = matchPath('/hello/world/blah', tokens, true);
                assert.deepEqual(m, {});
            });
            it('no match', () => {
                const m1 = matchPath('/hello/wrld', tokens);
                assert.deepEqual(m1, null);
                const m2 = matchPath('/hello/world/123', tokens);
                assert.deepEqual(m2, null);
            });
        });

        describe('/foo/{fooId}/bar/{barId}', () => {
            const tokens = tokenizePath('/foo/{fooId}/bar/{barId}');
            it('match whole', () => {
                const m = matchPath('/foo/123/bar/345', tokens);
                assert.deepEqual(m, { fooId: '123', barId: '345' });
            });
            it('match start', () => {
                const m = matchPath('/foo/123/bar/345/baz', tokens, true);
                assert.deepEqual(m, { fooId: '123', barId: '345' });
            });
            it('match special characters', () => {
                const m = matchPath('/foo/123:456/bar/345:789/baz', tokens, true);
                assert.deepEqual(m, { fooId: '123:456', barId: '345:789' });
            });
            it('no match', () => {
                const m = matchPath('/foo/123/bar/345/baz', tokens);
                assert.deepEqual(m, null);
            });
        });

        describe('/{filename}.{ext}', () => {
            const tokens = tokenizePath('/{filename}.{ext}');
            it('match whole', () => {
                const m = matchPath('/document.pdf', tokens);
                assert.deepEqual(m, { filename: 'document', ext: 'pdf' });
            });
            it('match start', () => {
                const m = matchPath('/document.pdf/123', tokens, true);
                assert.deepEqual(m, { filename: 'document', ext: 'pdf' });
            });
            it('no match', () => {
                const m1 = matchPath('/document.pdf/123', tokens);
                assert.deepEqual(m1, null);
            });
        });

    });

    describe('request dispatching', () => {

        class App extends Application {
            constructor() {
                super();
                this.container.bind(Router).to(FooRouter);
                this.container.bind(Router).to(BarRouter);
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
            assert.equal(res.status, 200);
            assert.equal(res.header['foo-before-all'], 'true');
            assert(res.header['bar-before-all'] == null);
            assert(res.header['foo-before-get-one'] == null);
            assert.deepEqual(res.body, ['foo1', 'foo2', 'foo3']);
        });

        it('POST /foo', async () => {
            const request = supertest(app.httpServer.callback());
            const res = await request.post('/foo')
                .send({ fooId: 'blah' });
            assert.equal(res.status, 201);
            assert.equal(res.header['foo-before-all'], 'true');
            assert(res.header['bar-before-all'] == null);
            assert(res.header['foo-before-get-one'] == null);
            assert.deepEqual(res.body, { fooId: 'blah' });
        });

        it('POST /foo with missing params', async () => {
            const request = supertest(app.httpServer.callback());
            const res = await request.post('/foo')
                .send({});
            assert.equal(res.status, 400);
            assert.equal(res.header['foo-before-all'], 'true');
            assert(res.header['bar-before-all'] == null);
            assert(res.header['foo-before-get-one'] == null);
            assert.deepEqual(res.body.name, 'RequestBodyValidationError');
        });

        it('POST /foo with incorrect params', async () => {
            const request = supertest(app.httpServer.callback());
            const res = await request.post('/foo')
                .send({ fooId: '' });
            assert.equal(res.status, 400);
            assert.equal(res.header['foo-before-all'], 'true');
            assert(res.header['bar-before-all'] == null);
            assert(res.header['foo-before-get-one'] == null);
            assert.deepEqual(res.body.name, 'RequestBodyValidationError');
        });

        it('GET /foo/{fooId}', async () => {
            const request = supertest(app.httpServer.callback());
            const res = await request.get('/foo/123');
            assert.equal(res.status, 200);
            assert.equal(res.header['foo-before-all'], 'true');
            assert.equal(res.header['foo-before-get-one'], '123');
            assert(res.header['bar-before-all'] == null);
            assert.deepEqual(res.body, { fooId: 123 });
        });

        it('GET /foo/{fooId}', async () => {
            const request = supertest(app.httpServer.callback());
            const res = await request.get('/foo/123');
            assert.equal(res.status, 200);
            assert.equal(res.header['foo-before-all'], 'true');
            assert.equal(res.header['foo-before-get-one'], '123');
            assert(res.header['bar-before-all'] == null);
            assert.deepEqual(res.body, { fooId: 123 });
        });

        it('PUT /foo/{fooId}', async () => {
            const request = supertest(app.httpServer.callback());
            const res = await request.put('/foo/123')
                .send({ bar: 'hello' });
            assert.equal(res.status, 200);
            assert.equal(res.header['foo-before-all'], 'true');
            assert.equal(res.header['foo-before-get-one'], '123');
            assert(res.header['bar-before-all'] == null);
            assert.deepEqual(res.body, { fooId: 123, bar: 'hello' });
        });

        it('GET /bar with default parameters', async () => {
            const request = supertest(app.httpServer.callback());
            const res = await request.get('/bar');
            assert.equal(res.status, 200);
            assert(res.header['bar-before-all'], 'true');
            assert(res.header['foo-before-all'] == null);
            assert(res.header['foo-before-get-one'] == null);
            assert.deepEqual(res.body, { sort: '+name', limit: 100, offset: 0 });
        });

        it('GET /bar with parameter overrides', async () => {
            const request = supertest(app.httpServer.callback());
            const res = await request.get('/bar?sort=-name&limit=1000&offset=50');
            assert.equal(res.status, 200);
            assert(res.header['bar-before-all'], 'true');
            assert(res.header['foo-before-all'] == null);
            assert(res.header['foo-before-get-one'] == null);
            assert.deepEqual(res.body, { sort: '-name', limit: 1000, offset: 50 });
        });

        it('GET /bar with invalid overrides', async () => {
            const request = supertest(app.httpServer.callback());
            const res = await request.get('/bar?limit=1001');
            assert.equal(res.status, 400);
            assert(res.header['bar-before-all'], 'true');
            assert(res.header['foo-before-all'] == null);
            assert(res.header['foo-before-get-one'] == null);
            assert.deepEqual(res.body.name, 'RequestParametersValidationError');
        });

        it('GET /bar with extraneous parameters', async () => {
            const request = supertest(app.httpServer.callback());
            const res = await request.get('/bar?blah=true&bleu=false');
            assert.equal(res.status, 200);
            assert(res.header['bar-before-all'], 'true');
            assert(res.header['foo-before-all'] == null);
            assert(res.header['foo-before-get-one'] == null);
            assert.deepEqual(res.body, { sort: '+name', limit: 100, offset: 0 });
        });

        it('POST /bar validates body', async () => {
            const request = supertest(app.httpServer.callback());
            const res = await request.post('/bar')
                .send({ invalid: true });
            assert.equal(res.status, 400);
            assert.equal(res.body.name, 'RequestBodyValidationError');
        });

        describe('multipart body', () => {

            it('POST /upload works with multipart requests', async () => {
                const request = supertest(app.httpServer.callback());
                const res = await request.post('/upload')
                    .field('foo', 'hello')
                    .attach('myFile', Buffer.from('some file content', 'utf-8'), {
                        filename: 'file.txt'
                    });
                assert.equal(res.status, 200);
                assert.equal(res.body.foo, 'hello');
                assert.equal(res.body.fileSize, 17);
            });

        });

    });

});
