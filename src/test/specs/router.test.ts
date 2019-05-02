import assert from 'assert';
import { tokenizePath, matchPath } from '../../main';

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
                const m2 = matchPath('/document.pdf.', tokens);
                assert.deepEqual(m2, null);
            });
        });

    });

});
