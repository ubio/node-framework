import assert from 'assert';
import { getAllFields, getValidationSchema } from '../../main';
import { User } from '../entities/user';
import { Country, City } from '../entities/nested';
import { TypeKit, Foo } from '../entities/typekit';
import expectedTypeKitSchema from '../entities/typekit-schema.json';
import { Teacher, Student } from '../entities/inherited';

describe('Entity', () => {

    it('getAllFields return all entity fields, including prototype chain', () => {
        const fields = getAllFields(User);
        assert.equal(fields.length, 8);
        assert.deepEqual(fields.map(_ => _.propertyKey).sort(), [
            'createdAt',
            'id',
            'meta',
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
                'meta',
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
            assert.deepEqual(presentation.meta, user.meta);
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

        it('uses presenter for nested entities', () => {
            const country = new Country();
            country.cities.push(City.fromJSON({ name: 'city name'}));
            const presentation = country.present();

            assert.deepEqual(presentation, {
                code: '',
                capital: { name: '' },
                cities: [ { name: 'city name' } ],
                languages: []
            })
        })
    });

    describe('serialization', () => {

        it('produces a JSON object, excluding serialized: false fields', () => {
            const user = new User();
            const json = JSON.parse(JSON.stringify(user));
            const keys = Object.keys(json).sort();
            assert.deepEqual(keys, [
                'createdAt',
                'id',
                'meta',
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
            const user = User.fromJSON({
                username: 'hello',
                organizationId: '00000000-0000-0000-0000-000000000000',
                createdAt: '123123123123'
            });
            assert.equal(user.username, 'hello');
            assert.equal(user.organizationId, '00000000-0000-0000-0000-000000000000');
            assert.equal(user.createdAt, 123123123123);
        });

        it('reads untyped fields from JSON object', () => {
            const examples = [
                null,
                false,
                true,
                {},
                { foo: 'bar' },
                [ 'foo', null ],
                '',
                'str',
                0,
                12.34
            ];

            for (const e of examples) {
                const user = User.fromJSON({ meta: e });
                assert.equal(user.meta, e);
            }
        });

        it('deserializes nested objects and arrays', () => {
            const country = Country.fromJSON({
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

        describe('integration', () => {

            const specs: { [key: string]: Array<[any, any]> } = {
                primitiveString: [
                    ['hello', 'hello'],
                    [90, '90'],
                    [false, 'false'],
                    [null, '']
                ],
                primitiveBoolean: [
                    [true, true],
                    [false, false],
                    ['true', true],
                    ['false', false],
                    [null, false],
                ],
                primitiveNumber: [
                    [2.71, 2.71],
                    ['2.71', 2.71],
                    [false, 0],
                    ['blah', 0],
                    [null, 0],
                ],
                primitiveInteger: [
                    [2, 2],
                    [2.71, 2],
                    ['2.71', 2],
                    [false, 0],
                    ['blah', 0],
                    [null, 0],
                ],
                primitiveObject: [
                    [{ foo: 1 }, { foo: 1}],
                    [null, {}],
                ],

                optionalString: [
                    ['hey', 'hey'],
                    [null, null],
                ],
                optionalBoolean: [
                    ['true', true],
                    [null, null],
                ],
                optionalNumber: [
                    ['0', 0],
                    [null, null],
                ],
                optionalInteger: [
                    ['0', 0],
                    [null, null],
                ],
                optionalObject: [
                    [{ foo: 1 }, { foo: 1}],
                    [null, null],
                ],

                arrayOfString: [
                    [['foo', 'bar'], ['foo', 'bar']],
                    ['foo', ['foo']],
                    [null, []],
                    [[null], []],
                    [['foo', null, 'bar'], ['foo', 'bar']],
                    [[90, true, null], ['90', 'true']],
                ],
                arrayOfBoolean: [
                    [[true, false], [true, false]],
                    [['true', 'false'], [true, false]],
                    [['true', null, 'false'], [true, false]],
                    [[90, 'bar', null], [false, false]],
                ],
                arrayOfNumber: [
                    [[0, 1, 2.71, 3.14], [0, 1, 2.71, 3.14]],
                    [['0', '1'], [0, 1]],
                    [['0', null, '1'], [0, 1]],
                ],
                arrayOfInteger: [
                    [[0, 1, 2.71, 3.14], [0, 1, 2, 3]],
                    [['0', '1'], [0, 1]],
                    [['0', null, '1'], [0, 1]],
                ],

                nestedOne: [
                    [{ foo: 'hi' }, Foo.fromJSON({ foo: 'hi' })],
                    [{}, Foo.fromJSON({ foo: 'hello' })],
                    [null, Foo.fromJSON({ foo: 'hello' })],
                ],
                nestedOptional: [
                    [{ foo: 'hi' }, Foo.fromJSON({ foo: 'hi' })],
                    [{}, Foo.fromJSON({ foo: 'hello' })],
                    [null, null],
                ],
                nestedMany: [
                    [
                        [{ foo: 'hi' }, { foo: 'hey'}],
                        [Foo.fromJSON({ foo: 'hi' }), Foo.fromJSON({ foo: 'hey' })]
                    ],
                    [
                        { foo: 'hi' },
                        [Foo.fromJSON({ foo: 'hi' })]
                    ],
                    [null, []],
                ]
            };

            for (const [key, values] of Object.entries(specs)) {
                for (const [rawValue, expectedValue] of values) {
                    const testName =
                        `deserializes ${key} from ${JSON.stringify(rawValue)} to ${JSON.stringify(expectedValue)}`;
                    it(testName, () => {
                        const kit: any = TypeKit.fromJSON({ [key]: rawValue });
                        assert.deepEqual(kit[key], expectedValue);
                        if (expectedValue != null) {
                            assert.equal(kit[key].constructor.prototype, expectedValue.constructor.prototype);
                        }
                        if (Array.isArray(expectedValue)) {
                            for (const [i, v] of expectedValue.entries()) {
                                assert.equal(v.constructor.prototype, expectedValue[i].constructor.prototype);
                            }
                        }
                    });
                }
            }

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
                properties: {
                    id: { type: 'string', format: 'uuid' },
                    createdAt: { type: 'number' },
                    updatedAt: { type: 'number' },
                    object: { type: 'string', const: 'user' },
                    organizationId: { type: 'string', format: 'uuid' },
                    username: { type: 'string', minLength: 6 }
                },
                required: [
                    'id',
                    'createdAt',
                    'updatedAt',
                    'object',
                    'organizationId',
                    'username'
                ],
                additionalProperties: true
            });
        });

        describe('integration', () => {

            it('generates valid schema for all valid field schema types', () => {
                const schema = getValidationSchema(TypeKit);
                assert.deepEqual(schema, expectedTypeKitSchema);
            });

        });

    });

    describe('clone', () => {

        it('should return an exact copy of an object', () => {
            const country = Country.fromJSON({
                code: 'ch',
                capital: {
                    name: 'Bern'
                },
                cities: [
                    { name: 'Zurich' },
                    { name: 'Basel' },
                    { name: 'Geneva' },
                    { name: 'Lausanne' },
                ]
            });
            const clone = country.clone();
            assert.notEqual(country, clone);
            assert.deepEqual(country.toJSON(), clone.toJSON());
            assert(clone instanceof Country);
            assert(clone.capital instanceof City);
            for (const city of clone.cities) {
                assert(city instanceof City);
            }
        });

    });

    describe('inherited entities', () => {

        it('have inherited fields', () => {
            const teacherFields = getAllFields(Teacher).map(_ => _.propertyKey);
            const studentFields = getAllFields(Student).map(_ => _.propertyKey);
            assert.deepEqual(teacherFields, ['name', 'major']);
            assert.deepEqual(studentFields, ['name', 'gpa']);
        });

    });

});
