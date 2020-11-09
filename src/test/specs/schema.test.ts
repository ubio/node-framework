import { v4 as uuid } from 'uuid';
import { Schema } from '../../main';
import assert from 'assert';

interface Book {
    id: string;
    title: string;
    year: number;
    tags: string[];
}

const Book = new Schema<Book>({
    schema: {
        type: 'object',
        required: ['id', 'title', 'year', 'tags'],
        properties: {
            id: { type: 'string', minLength: 1 },
            title: { type: 'string', minLength: 1 },
            year: { type: 'integer', min: 0, max: 3000 },
            tags: {
                type: 'array',
                items: { type: 'string', minLength: 1 },
            },
        },
        additionalProperties: false,
    },
    defaults: () => {
        return {
            id: uuid(),
            tags: [],
        };
    },
});

describe('Schema', () => {

    describe('schema', () => {

        it('returns JSON Schema object', () => {
            assert.deepStrictEqual(Book.schema, {
                type: 'object',
                required: ['id', 'title', 'year', 'tags'],
                properties: {
                    id: { type: 'string', minLength: 1 },
                    title: { type: 'string', minLength: 1 },
                    year: { type: 'integer', min: 0, max: 3000 },
                    tags: {
                        type: 'array',
                        items: { type: 'string', minLength: 1 },
                    },
                },
                additionalProperties: false,
            });
        });
    });

    describe('listSchema', () => {
        it('returns JSON Schema object', () => {
            assert.deepStrictEqual(Book.listSchema, {
                type: 'object',
                required: ['type', 'count', 'data'],
                properties: {
                    type: { type: 'string',  const: 'list' },
                    count: { type: 'number' },
                    data: {
                        type: 'array',
                        items: {
                            type: 'object',
                            required: ['id', 'title', 'year', 'tags'],
                            properties: {
                                id: { type: 'string', minLength: 1 },
                                title: { type: 'string', minLength: 1 },
                                year: { type: 'integer', min: 0, max: 3000 },
                                tags: {
                                    type: 'array',
                                    items: { type: 'string', minLength: 1 },
                                },
                            },
                            additionalProperties: false,
                        }
                    },
                }
            });
        });
    });

    describe('decode', () => {

        it('applies defaults', () => {
            const book = Book.decode({
                title: 'The Adventures of Foo',
                year: 2020,
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
            });
            assert(book.id.length > 0);
            assert.deepStrictEqual(book.tags, ['foo', 'bar', 'baz']);
        });

        it('removes additional properties', () => {
            const book = Book.decode({
                title: 'The Adventures of Foo',
                year: 2020,
                something: 'boo',
            }) as any;
            assert(typeof book.something === 'undefined');
        });

        it('throws ValidationError if not valid', () => {
            try {
                Book.decode({
                    title: 'The Adventures of Foo',
                    year: 2020,
                    tags: 'lol wut',
                });
                throw new Error('UnexpectedSuccess');
            } catch (err) {
                assert.strictEqual(err.name, 'ValidationError');
            }
        });
    });
});
