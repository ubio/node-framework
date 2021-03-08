import assert from 'assert';

import { env } from '../../main';

describe('env', () => {

    beforeEach(() => {
        env.resetEnv();
        process.env.TEST_STRING = 'string';
        process.env.TEST_NUMBER = '123';
        process.env.TEST_NOT_NUMBER = 'blah';
        delete process.env.TEST_MISSING;
    });

    describe('readString', () => {

        it('reads string variable', () => {
            const val = env.readString('TEST_STRING');
            assert.equal(val, 'string');
            assert.deepEqual(env.missingKeys, []);
        });

        it('missing: returns default value if specified', () => {
            const val = env.readString('TEST_MISSING', 'default');
            assert.equal(val, 'default');
            assert.deepEqual(env.missingKeys, []);
        });

        it('missing: returns empty string and reports missing env', () => {
            const val = env.readString('TEST_MISSING');
            assert.equal(val, '');
            assert.deepEqual(env.missingKeys, ['TEST_MISSING']);
        });

    });

    describe('readNumber', () => {

        it('reads number variable', () => {
            const val = env.readNumber('TEST_NUMBER');
            assert.equal(val, '123');
            assert.deepEqual(env.missingKeys, []);
        });

        it('missing: returns default value if specified', () => {
            const val = env.readNumber('TEST_MISSING', 567);
            assert.equal(val, 567);
            assert.deepEqual(env.missingKeys, []);
        });

        it('missing: returns 0 and reports missing env', () => {
            const val = env.readNumber('TEST_MISSING');
            assert.equal(val, 0);
            assert.deepEqual(env.missingKeys, ['TEST_MISSING']);
        });

        it('not a number: returns default number if specified', () => {
            const val = env.readNumber('TEST_NOT_NUMBER', 567);
            assert.equal(val, 567);
            assert.deepEqual(env.missingKeys, []);
        });

        it('not a number: returns 0 and reports missing env', () => {
            const val = env.readNumber('TEST_NOT_NUMBER');
            assert.equal(val, 0);
            assert.deepEqual(env.missingKeys, ['TEST_NOT_NUMBER']);
        });

    });

    describe('assertEnv', () => {

        it('does not throw if all variables present', () => {
            env.readString('TEST_STRING');
            env.readNumber('TEST_NUMBER');
            env.assertEnv();
        });

        it('throws if some variables are missing', () => {
            env.readString('TEST_MISSING');
            env.readNumber('TEST_NOT_NUMBER');
            try {
                env.assertEnv();
                throw new Error('Unexpected success');
            } catch (err) {
                assert(err.message.includes('TEST_MISSING'));
                assert(err.message.includes('TEST_NOT_NUMBER'));
            }
        });

    });

});
