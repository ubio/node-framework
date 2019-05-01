import assert from 'assert';
import { User } from '../entities/user';
import { getAllFields } from '../../main';

describe.only('Entity', () => {

    it('getAllFields return all entity fields, including prototype chain', () => {
        const fields = getAllFields(User);
        assert.equal(fields.length, 7);
        assert.deepEqual(fields.map(_ => _.propertyKey).sort(), [
            'createdAt',
            'id',
            'object',
            'organizationId',
            'passwordSha256',
            'updatedAt',
            'username',
        ]);
    });

    describe('presenters', () => {

        it('default presenter returns all fields', () => {
            const user = new User();
            const presentation = user.present() as any;
            const keys = Object.keys(presentation).sort();
            assert.deepEqual(keys, [
                'createdAt',
                'id',
                'object',
                'organizationId',
                'passwordSha256',
                'updatedAt',
                'username',
            ]);
            assert.equal(presentation.object, 'user');
            assert(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(presentation.id));
            assert.equal(presentation.organizationId, '');
            assert.equal(presentation.username, '');
            assert.equal(presentation.passwordSha256, '');
            assert.equal(typeof presentation.createdAt, 'number');
            assert.equal(typeof presentation.updatedAt, 'number');
        });

        it('public presenter returns only whitelisted fields', () => {
            const user = new User();
            const presentation = user.present('public');
            const keys = Object.keys(presentation).sort();
            assert.deepEqual(keys, [
                'createdAt',
                'id',
                'object',
                'organizationId',
                'updatedAt',
                'username',
            ]);
        });

    });

    describe('serialization', () => {

        it('produces a JSON object, excluding serialized: false fields', () => {
            const user = new User();
            const json = JSON.parse(JSON.stringify(user));
            const keys = Object.keys(json).sort();
            assert.deepEqual(keys, [
                'createdAt',
                'id',
                'organizationId',
                'passwordSha256',
                'updatedAt',
                'username',
            ]);
        });

        it('serializes nested objects');
        it('serializes nested arrays');

    });

    describe('deserialization', () => {

        it('reads fields from JSON object, coercing primitive types', () => {
            const user = new User();
            user.assign({
                username: 'hello',
                organizationId: '00000000-0000-0000-0000-000000000000',
                createdAt: '123123123123'
            });
            console.log(user);
            assert.equal(user.username, 'hello');
            assert.equal(user.organizationId, '00000000-0000-0000-0000-000000000000');
            assert.equal(user.createdAt, 123123123123);
        });

        it('deserializes nested objects');
        it('deserializes nested arrays');

    });

});
