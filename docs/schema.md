# Schema and Domain Model

Application typically deals with a number of entities within its domain model.

The Framework offers a structural convention to describe each model using an `interface` and accompanying JSON Schema.

```ts
// schema/user.ts
export interface User {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    roles: string[];
    age?: number;
}

export const User = new Schema<User> {
    schema: {

    },
    defaults: () => {
        return {
            id: uuid(),
        };
    }
};
```

This snippets defines a `User` data type and an instance of User schema (it's perfectly fine for those to share the same name, because there is no ambiguity between a type definition and variable name in TypeScript).

The `User` schema instance contains useful functionality for working with domain model objects:

- `User.schema` is a JSON Schema object (e.g. can be used to as part of Open API specs)
- `User.decode(randomObjectFromDatabase)` applies the defaults, validates the object and returns it if validation is successful, otherwise throws a `ValidationError`.
- `User.validate(obj)` validates the object and returns a list of errors if validation fails; *does not apply defaults*.

**Note** Decoded domain model objects remain plain JavaScript objects at runtime (vs. class instances), so `instanceof` checks are not applicable (nor possible with `interface`).

## Typesafe Schema & Pre-processing

By default schema is typechecked to eliminate typical human errors notoriously associated with JSON Schema:

    - typos in `properties` keys
    - missed keys or typos in `required`
    - extraneous keys in `required`
    - incorrect `type`, not matching to interface definition
    - missed `nullable`

For this purpose the support of JSON schema is reduced to a stricter subset. Specifically:

    - `type` only supports a single value; use `nullable: true` if support for `[someType, 'null']` is required
    - `required` is auto-generated during schema preprocessing, properties are treated as required by default unless `optional: true` is specified on them (this can be turned off)
    - `additionalProperties: false` is automatically added (this can be turned off if needed)
    - `anyOf`, `allOf` and other schema combinators are not supported
    - `ref` are not supported; instead use direct references between schemata
    - tuple validation is not supported with arrays, only homogeneous arrays are supported

In rare cases it might be necessary to switch off strict type checking (e.g. if support for union types or other unsupported functionality). To do that cast the `schema` to `any` during declaration and disable any preprocessing option as needed. This is not recommended though, so please take care to document the decision.

## Additional Properties

Whilst it is generally a good idea to allow additional parameters for http requests (especially useful in migrations and future-compatibility releases), it is typically not desirable to allow additional properties on domain model objects.

Schema instance includes `removeAdditional: 'all'` by default so will remove any additional properties **both during decoding and validation(!)**.
