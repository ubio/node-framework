import assert from 'assert';
import { User } from '../entities/user';
import { getAllFields, getValidationSchema } from '../../main';
import { Country, City } from '../entities/nested';

describe('Entity', () => {

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

        it('serializes nested objects and arrays', () => {
            const country = new Country();
            country.code = 'che';
            country.capital.name = 'Bern';
            const city1 = new City();
            city1.name = 'Bern';
            const city2 = new City();
            city2.name = 'Zurich';
            country.cities = [city1, city2];
            country.languages = ['de', 'fr', 'en'];
            const json = JSON.parse(JSON.stringify(country));
            assert.deepEqual(json, {
                code: 'che',
                capital: { name: 'Bern' },
                cities: [
                    { name: 'Bern' },
                    { name: 'Zurich' },
                ],
                languages: ['de', 'fr', 'en']
            });
        });

    });

    describe('deserialization', () => {

        it('reads fields from JSON object, coercing primitive types', () => {
            const user = new User();
            user.assign({
                username: 'hello',
                organizationId: '00000000-0000-0000-0000-000000000000',
                createdAt: '123123123123'
            });
            assert.equal(user.username, 'hello');
            assert.equal(user.organizationId, '00000000-0000-0000-0000-000000000000');
            assert.equal(user.createdAt, 123123123123);
        });

        it('deserializes nested objects and arrays', () => {
            const country = new Country().assign({
                code: 'che',
                capital: { name: 'Bern' },
                cities: [
                    { name: 'Bern' },
                    { name: 'Zurich' },
                    { name: 'Geneva' },
                    { name: 'Basel' },
                    { name: 'Lucerne' },
                    { name: 'Lausanne' },
                ],
                languages: ['de', 'fr', 'en'],
            });
            assert.equal(country.code, 'che');
            assert(country.capital instanceof City);
            assert.equal(country.capital.name, 'Bern');
            assert(country.cities instanceof Array);
            for (const city of country.cities) {
                assert(city instanceof City);
                assert.equal(typeof city.name, 'string');
            }
            assert(country.languages instanceof Array);
            for (const lang of country.languages) {
                assert.equal(typeof lang, 'string');
            }
            const cityNames = country.cities.map(_ => _.name);
            assert.deepEqual(cityNames, ['Bern', 'Zurich', 'Geneva', 'Basel', 'Lucerne', 'Lausanne']);
        });

    });

    describe('validate', () => {

        it('throws if entity is invalid', () => {
            const user = new User();
            try {
                user.validate();
                throw new Error('Unexpected success');
            } catch (err) {
                assert.equal(err.name, 'EntityValidationError');
                const messages: string[] = err.details.messages;
                const paths = messages.map(_ => _.split(' ')[0]);
                assert.deepEqual(paths, ['/organizationId', '/username', '/passwordSha256']);
            }
        });

        it('does not throw if entity is valid', () => {
            const user = new User();
            user.organizationId = '00000000-0000-0000-0000-000000000000';
            user.username = 'joejoe';
            user.passwordSha256 = '488db9fc70392d1a92a62fa4098651f69817c3f12d78ce10a1ab16e9c8674442';
            user.validate();
        });

    });

    describe('getValidationSchema', () => {

        it('returns JSON schema of presenter', () => {
            const schema = getValidationSchema(User, 'public');
            assert.deepEqual(schema, {
                type: 'object',
                properties:
                {
                    id: { type: 'string', format: 'uuid' },
                    createdAt: { type: 'number' },
                    updatedAt: { type: 'number' },
                    object: { type: 'string', const: 'user' },
                    organizationId: { type: 'string', format: 'uuid' },
                    username: { type: 'string', minLength: 6 }
                },
                required:
                    ['id',
                        'createdAt',
                        'updatedAt',
                        'object',
                        'organizationId',
                        'username'],
                additionalProperties: false
            });
        });

    });

});
