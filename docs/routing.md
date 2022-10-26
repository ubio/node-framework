# Routing Requests

Application dispatches incoming HTTP requests using Routers. Routers are classes with methods annotated with a set or routing decoraters. Such decorators take care of following responsibilities:

- define request matching criteria (HTTP method and pathname pattern),
- provide meta-information about the response format, so that OpenAPI documentation could be generated,
- define request parameters specs, which allows framework to automatically extract and validate them from path, query string and JSON body.

Each router should be registered with [application container](./application.md) using `bindAll` method.

## Example

```ts
import { Router, Get } from '@ubio/framework';
import { injectable } from 'inversify';

@injectable()
export class StatusRouter extends Router {

    @Get({
        path: '/status',
        responses: {
            200: {
                schema: {
                    type: 'object',
                    properties: {
                        version: { type: 'string' }
                    }
                }
            }
        }
    })
    async status() {
        return { version: pkg.version };
    }

}
```

Don't forget to register the `StatusRouter` in `app.ts`:

```ts
import { Application, Router } from '@ubio/framework';
import { StatusRouter } from './routes/status';

export class App extends Application {
    constructor() {
        // ...
        this.bindRouter(StatusRouter);
    }
}

```

Now requesting `/status` should return the JSON with your application version.

## Middleware and Endpoints

Routers support two kinds of methods:

- **endpoints** are decorated with `@Get`, `@Post`, `@Put` or `@Delete`
- **middleware** methods are decorated with `@Middleware`

Application dispatches each request as follows:

- first, it looks through all the endpoints and picks the first one that matches request method and `path`
    - if no such endpoint is found, application finishes the request processing, throwing `RouteNotFoundError` error with 404 status (which is subsequently processed by error handling middleware)
- next, application will try to match and execute all middleware **in the same router as the endpoint**, in the order the methods are defined in the class
    - if middleware specifies `path`, then only the middleware which match the said path pattern are executed
    - middleware specified in other routers are not executed, even if they match the request
    - middleware parameters are treated in the same way as endpoint parameters, specifically, middleware will throw an error if it contains request parameters specs and one of them fail validation
- finally, an endpoint is executed as follows:
    - request parameters are extracted from the request using method parameters decorators
    - all request parameters are validated against their `schema`
    - if `schema` specifies `default` and parameter was not provider, the `default` value is used
    - parameter validator also performs type coercion as per [docs](https://github.com/epoberezkin/ajv/blob/master/COERCION.md)
    - all processed parameters are also accessible via `this.params` from Router
    - the return value of the endpoint is treated as a JSON response payload
    - it is possible for the endpoint to specify the response status using `this.ctx.status =`
    - for non-JSON responses endpoint should set `this.ctx.body` property as per [Koa docs](https://github.com/koajs/koa/blob/master/docs/api/response.md#responsebody) and should **not** return any value

## Request Parameters

Request parameters are extracted and validated using `@PathParam`, `@QueryParam` and `@BodyParam` decorators, applied to request methods (the order of parameters is not important).

Consider the following example:

```ts
@Get({
    path: '/screenshots',
    responses: {
        200: { schema: createListSchema(Screenshot) }
    },
})
async list(
    @QueryParam('jobId', { schema: { type: 'string', format: 'uuid' } })
    jobId: string,
    @QueryParam('executionId', { schema: { type: 'string', format: 'uuid' } })
    executionId: string,
    @QueryParam('since', { schema: { type: 'number', minimum: 0, default: 0 } })
    since: number,
    @QueryParam('limit', { schema: { type: 'number', minimum: 0, maximum: 1000, default: 100 } })
    limit: number,
    @QueryParam('offset', { schema: { type: 'number', minimum: 0, default: 0 } })
    offset: number,
    @QueryParam('sort', { schema: { type: 'string', default: '+timestamp' } })
    sort: string,
) {
    this.logger.addContextData({ jobId, executionId });
    const { totalCount, entities } = await this.screenshotsRepo({
        executionId,
        jobId,
        since,
        limit,
        offset,
        sort
    });
    return {
        object: 'list',
        count: totalCount,
        data: entities.map(_ => _.presentPrivate())
    };
}
```

### Runtime vs. Compile Time Validation

Framework uses [JSON schema](https://json-schema.org/) to perform **runtime** validation of request parameters.

It is developer's responsibility to make sure that **compile time** type correctly corresponds to JSON Schema. There is currently no automatic way of checking this at compile time, without sacrificing the JSON flexibility and ability to generate route metadata.

For this reason is highly advisable to stick with primitive types (i.e. multiple arguments each annotated with simple schema vs. a single object with a complex schema). Another advantage of this approach is that it allows generating Open API documentation for each individual field.
