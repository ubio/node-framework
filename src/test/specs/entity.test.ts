import assert from 'assert';
import { User } from '../entities/user';
import { getAllFields } from '../../main';
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

});
