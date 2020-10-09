# Error Handling

Within HTTP server context all errors thrown from any part of code are processed by [error handler middleware](../src/main/middleware/error-handler.ts) which takes care of presenting them in a standardized way in a JSON payload:


```ts
{
  name: 'AccessForbidden',
  message: 'Access to specified resource is restricted'
  details: {
      customInfo: 'blah'
  },
}
```

To make error appear in this way it should be a subclass of `Exception` class.

```
export class MyCustomError {
    message = 'Something wrong just happened';
    // Message can be also provided as a constructor parameter,
    // or defined inside a constructor if it contains dynamic parts
}
```

Errors that are not subclass of `Exception` are formatted as a generic `ServerError`.

The fields have following meaning:

- `name` should be interpreted as error code, it should be derived from class name in most circumstances
- `message` is a human-readable message with minimal explanation of what went wrong (note: tutorial-style messages should be avoided, please contact author for reasoning)
- `details` is an optional object containing relevant context

**Important note.** Error messages and details should not contain sensitive info, including parts of inputs, url, query parameters, etc.
