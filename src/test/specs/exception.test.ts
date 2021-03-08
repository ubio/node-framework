import assert from 'assert';

import { ClientError, Exception } from '../../main';

describe('Exception', () => {

    it('infers name from class name', () => {
        class MyCustomError extends Exception {}
        const err = new MyCustomError();
        assert.strictEqual(err.name, 'MyCustomError');
    });

    it('allows overriding message by property assignment', () => {
        class MyCustomError extends Exception {
            message = 'Custom message';
        }
        const err = new MyCustomError();
        assert.strictEqual(err.message, 'Custom message');
    });

    it('supports custom details', () => {
        class MyCustomError extends Exception {
            message = 'Custom message';
            constructor(foo: string) {
                super();
                this.details = { foo };
            }
        }
        const err = new MyCustomError('blah');
        assert.strictEqual(err.message, 'Custom message');
        assert.deepStrictEqual(err.details, { foo: 'blah' });
    });

});

describe('ClientError', () => {

    it('supports custom status code', () => {
        class MyCustomError extends ClientError {
            status = 400;
        }
        const err = new MyCustomError();
        assert.strictEqual(err.status, 400);
    });

    it('default status is 400', () => {
        class MyCustomError extends ClientError {}
        const err = new MyCustomError();
        assert.strictEqual(err.status, 400);
    });

});
