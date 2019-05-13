import { Entity, Field } from '../../main';

export class Foo extends Entity {
    @Field({ schema: { type: 'string' } })
    foo: string = 'hello';
}

export class TypeKit extends Entity {
    @Field({ schema: { type: 'string' } })
    primitiveString: string = '';
    @Field({ schema: { type: 'boolean' } })
    primitiveBoolean: boolean = false;
    @Field({ schema: { type: 'integer' } })
    primitiveInteger: number = 10;
    @Field({ schema: { type: 'number' } })
    primitiveNumber: number = 10;
    @Field({ schema: { type: 'object' } })
    primitiveObject: object = {};

    @Field({ nullable: true, schema: { type: 'string' } })
    optionalString: string | null = null;
    @Field({ nullable: true, schema: { type: 'boolean' } })
    optionalBoolean: boolean | null = null;
    @Field({ nullable: true, schema: { type: 'integer' } })
    optionalInteger: number | null = null;
    @Field({ nullable: true, schema: { type: 'number' } })
    optionalNumber: number | null = null;
    @Field({ nullable: true, schema: { type: 'object' } })
    optionalObject: object | null = null;

    @Field({ schema: { type: 'array', items: { type: 'string' } } })
    arrayOfString: string[] = [];
    @Field({ schema: { type: 'array', items: { type: 'boolean' } } })
    arrayOfBoolean: boolean[] = [];
    @Field({ schema: { type: 'array', items: { type: 'integer' } } })
    arrayOfInteger: number[] = [];
    @Field({ schema: { type: 'array', items: { type: 'number' } } })
    arrayOfNumber: number[] = [];
    @Field({ schema: { type: 'array', items: { type: 'object' } } })
    arrayOfObject: object[] = [];

    @Field({ entity: Foo, schema: { type: 'object' } })
    nestedOne: Foo = new Foo();
    @Field({ nullable: true, entity: Foo, schema: { type: 'object' } })
    nestedOptional: Foo | null = null;
    @Field({ entity: Foo, schema: { type: 'array' } })
    nestedMany: Foo[] = [];
}
