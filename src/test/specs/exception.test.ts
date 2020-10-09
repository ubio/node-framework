import assert from 'assert';
import { Exception } from '../../main';

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

    it('supports custom status code', () => {
        class MyCustomError extends Exception {
            status = 400;
        }
        const err = new MyCustomError();
        assert.strictEqual(err.status, 400);
    });

    it('default status is 500', () => {
        class MyCustomError extends Exception {}
        const err = new MyCustomError();
        assert.strictEqual(err.status, 500);
    });

});
