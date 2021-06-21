import assert from 'assert';
import { v4 as uuid } from 'uuid';

import { Schema } from '../../main';

interface Person {
    name: string;
    age?: number;
    gender: string | null;
}

const Person = new Schema<Person>({
    schema: {
        type: 'object',
        properties: {
            name: { type: 'string' },
            age: { type: 'number', optional: true },
            gender: { type: 'string', nullable: true },
        }
    }
});

const People = new Schema<Person[]>({
    schema: {
        type: 'array',
        items: Person.schema
    }
});

interface Book {
    id: string;
    title: string;
    year: number;
    tags: string[];
    author: Person;
}

const Book = new Schema<Book>({
    schema: {
        type: 'object',
        properties: {
            id: { type: 'string', minLength: 1 },
            title: { type: 'string', minLength: 1 },
            year: { type: 'integer', minimum: 0, maximum: 3000 },
            tags: {
                type: 'array',
                items: { type: 'string', minLength: 1 },
            },
            author: Person.schema,
        },
    },
    defaults: () => {
        return {
            id: uuid(),
            tags: [],
        };
    },
});

describe('Schema', () => {

    describe('preprocessed schema', () => {

        it('returns JSON Schema object', () => {
            assert.deepStrictEqual(Book.schema, {
                type: 'object',
                required: ['id', 'title', 'year', 'tags', 'author'],
                properties: {
                    id: { type: 'string', minLength: 1 },
                    title: { type: 'string', minLength: 1 },
                    year: { type: 'integer', minimum: 0, maximum: 3000 },
                    tags: {
                        type: 'array',
                        items: { type: 'string', minLength: 1 },
                    },
                    author: {
                        type: 'object',
                        required: ['name', 'gender'],
                        properties: {
                            name: { type: 'string' },
                            age: { type: 'number', optional: true },
                            gender: { type: 'string', nullable: true },
                        },
                        additionalProperties: false,
                    }
                },
                additionalProperties: false,
            });
        });
    });

    describe('decode', () => {

        it('applies defaults', () => {
            const book = Book.decode({
                title: 'The Adventures of Foo',
                year: 2020,
                author: { name: 'Joe', gender: null }
            });
            assert(typeof book.id === 'string');
            assert(book.id.length > 0);
            assert.strictEqual(book.title, 'The Adventures of Foo');
            assert.strictEqual(book.year, 2020);
            assert.deepStrictEqual(book.tags, []);
        });

        it('defaults are overwritten', () => {
            const book = Book.decode({
                title: 'The Adventures of Foo',
                year: 2020,
                tags: ['foo', 'bar', 'baz'],
                author: { name: 'Joe', gender: null },
            });
            assert(book.id.length > 0);
            assert.deepStrictEqual(book.tags, ['foo', 'bar', 'baz']);
        });

        it('removes additional properties', () => {
            const book = Book.decode({
                title: 'The Adventures of Foo',
                year: 2020,
                something: 'boo',
                author: { name: 'Joe', gender: null },
            }) as any;
            assert(typeof book.something === 'undefined');
        });

        it('throws ValidationError if not valid', () => {
            try {
                Book.decode({
                    title: 'The Adventures of Foo',
                    year: 2020,
                    tags: 'lol wut',
                    author: { name: 'Joe', age: 'ok' }
                });
                throw new Error('UnexpectedSuccess');
            } catch (err) {
                assert.strictEqual(err.name, 'ValidationError');
            }
        });

        it('works with top level arrays', () => {
            const nobody = People.decode([]);
            const people = People.decode([{ name: 'Ron', gender: null }]);
            assert(Array.isArray(nobody));
            assert.strictEqual(people[0].name, 'Ron');
            assert.strictEqual(people[0].gender, null);
        });
    });
});
