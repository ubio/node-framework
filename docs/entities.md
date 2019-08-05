# Entities

Entities are domain objects with defined _identity_. Simply speaking, two entities are considered the same if their identity fields are equal. This allows unambiguously referencing such objects by their ids, and makes them suitable for storing in databases and exposing via RESTful APIs. Most of the domain objects are entities.

Framework takes care of following common operations with entities:

- validating fields using JSON schema
- presenting entity into various formats
- generating JSON schema for presenters (e.g. for OpenAPI documentation)
- deserializing entity fields from raw JSON object
- serializing entity into a raw JSON object

## Example

```ts
export class User extends Entity {
    @Field({
        schema: { type: 'string', const: 'user' },
        serialized: false,
        presenters: ['public']
    })
    get object() { return 'user'; }

    @Field({
        schema: { type: 'string', format: 'uuid' },
        presenters: ['public']
    })
    id: string = uuid.v4();

    @Field({
        schema: { type: 'string', format: 'uuid' },
        presenters: ['public']
    })
    organizationId: string = '';

    @Field({
        schema: { type: 'string', minLength: 6 },
        presenters: ['public']
    })
    username: string = '';

    @Field({
        schema: { type: 'string', minLength: 6 },
    })
    passwordSha256: string = '';

    @Field({
        schema: { type: 'number' },
        presenters: ['public']
    })
    createdAt: number = Date.now();

    @Field({
        schema: { type: 'number' },
        presenters: ['public']
    })
    updatedAt: number = Date.now();
}
```

In this example, User entity declares following fields:

- `id`, defaulting to random UUID
- `organizationId`
- `username`
- `passwordSha256`
- `createdAt`
- `updatedAt`

By convention, it also defines a computed property `object` with constant value `user`, which describes its type in serialized form.

### Base Entity

It is very common for entities to declare `id`, `createdAt`, `updatedAt` fields just like in example above. Therefore, we added `BaseEntity` which includes these three fields, so the above example can be rewritten as follows:

```ts
export class User extends BaseEntity {
    @Field({
        schema: { type: 'string', const: 'user' },
        serialized: false,
        presenters: ['public']
    })
    get object() { return 'user'; }

    @Field({
        schema: { type: 'string', format: 'uuid' },
        presenters: ['public']
    })
    organizationId: string = '';

    @Field({
        schema: { type: 'string', minLength: 6 },
        presenters: ['public']
    })
    username: string = '';

    @Field({
        schema: { type: 'string', minLength: 6 },
    })
    passwordSha256: string = '';
}
```

## Presenters

When exposed via RESTful APIs or by other means, entities are typically presented in JSON format. It is common to want to omit some of the fields depending on the presentation, for example, for User entity we don't include `passwordSha256` field in its `public` presentation.

```ts
const user = new User();
user.present('public');
// { id: '5845b01d-46b2-4541-b7a1-6568718de547',
//   createdAt: 1556713076443,
//   updatedAt: 1556713076443,
//   object: 'user',
//   organizationId: '',
//   username: '' }
```

The default presenter (with presenter key omitted) emits all fields:

```ts
const user = new User();
user.present();
// { id: 'c9c7b55f-9004-439b-854a-a07b84690ffc',
//   createdAt: 1556713261232,
//   updatedAt: 1556713261232,
//   object: 'user',
//   organizationId: '',
//   username: '',
//   passwordSha256: '' }
```

## Serialization

Entity serialization is performed simply by `JSON.stringify(entity)` it, which in turn invokes `toJSON`.

This produces a JSON object with fields marked as `serialized: false` removed.

```ts
const user = new User();
JSON.stringify(user);
// { id: 'c7d518e3-d574-41ab-8b66-ca8de022b6c5',
//   createdAt: 1556714733179,
//   updatedAt: 1556714733179,
//   organizationId: '',
//   username: '',
//   passwordSha256: '' }
```

Notice how `object: 'user'` field is missing in serialized form, because it shouldn't be saved to database.

Computed fields are also serialized by default, and any field can be excluded from serialization with `serialized: false`. Controlling which fields are serialized and which are presented allows applications to handle different migrations on-fly like renaming fields and writing computed fields to database (e.g. for backwards compatibility between versions).

## Deserialization

Unpacking an entity from a raw JSON object is possible either by explicitly updating all the fields, via static `fromJSON` or instance method `assign`:

```ts
// Create from JSON
const user = User.fromJSON({
    username: 'hello',
    createdAt: '123123123123'
    unrelated: 'foo'
});
// Update fields
user.assign({
    organizationId: '00000000-0000-0000-0000-000000000000',
    other: 'blah',
});
console.log(user);
// User {
//   id: 'fac3fed7-74eb-4d79-b086-83761365caf8',
//   createdAt: 123123123123,
//   updatedAt: 1556715330054,
//   organizationId: '00000000-0000-0000-0000-000000000000',
//   username: 'hello',
//   passwordSha256: '' }
```

Notice how `createdAt` was automatically coerced to a number from string, and how `unrelated` field was not included.

## Nested entities

This section is under development.

## Nullable (optional) fields

Fields are non-nullable (required) by default. To make fields nullable they must be defined like this:

```ts
    @Field({
        schema: { type: 'string' },
        required: false,
    })
    assigneeId: string | null = null;
```

Nullable fields should only be used when domain explicitly allows missing values (e.g. an issue may not have an assignee). Nullable fields should not be confused with uninitialized required fields, and as such should not be used for initializing fields that are not optional. For initializing required fields you must use the default value of the same type as the type of the field. For example, the User entity above has required `organizationId: string` field which is initialized with an empty string which, if unassigned, will fail validation before being saved into database.

JSON schema for nullable types will automatically be enhanced to allow `null` value. In example above, it'll be `{ type: ['null', 'string'] }` so you don't have to manually specify that.

## Validation

Entity is validated *synchronously* by calling `validate`.

```ts
const user = new User();
user.validate();
// throws EntityValidationError
```

Entities can also generate JSON schema for each of their presenters. This is useful for declaring OpenAPI response specs.

```ts
import { getValidationSchema } from '@ubio/framework';

const userPublicSchema = getValidationSchema(User, 'public');
// { type: 'object',
//   properties:
//    { id: { type: 'string', format: 'uuid' },
//      createdAt: { type: 'number' },
//      updatedAt: { type: 'number' },
//      object: { type: 'string', const: 'user' },
//      organizationId: { type: 'string', format: 'uuid' },
//      username: { type: 'string', minLength: 6 } },
//   required:
//    [ 'id',
//      'createdAt',
//      'updatedAt',
//      'object',
//      'organizationId',
//      'username' ],
//   additionalProperties: false }
```

## Nested entities

Entities can embed other entities and even arrays of entities. Framework will take care of (de)serializing them from/to raw JSON, as well as generating correct validation schema for them.

You can find some examples of how to define embedded entities in [tests](../src/test/entities).
