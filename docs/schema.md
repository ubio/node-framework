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

*Note 1*: decoded domain model objects are guaranteed to satisfy the interface; however, there is technically no way to validate that the JSON Schema fully corresponds to an interface definition. This will have to be covered with tests.

*Note 2*: decoded domain model objects remain plain JavaScript objects at runtime (vs. class instances), so `instanceof` checks are not applicable (nor possible with `interface`s).

## Additional Properties

Whilst it is generally a good idea to allow additional parameters for http requests (especially useful in migrations and future-compatibility releases), it is typically not desirable to allow additional properties on domain model objects.

Schema instance includes `removeAdditional: true` by default so will remove any additional properties during decoding and validation(!) — as long as schema specifies `additionalProperties: false`.
