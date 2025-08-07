# Request flow After Hooks

Just like middlewares, you can define class methods that are meant to executed after routes endpoint.

```ts
export class MyRouter extends Router {

    @AfterHook()
    async setHeaders() {
        // this will be executed for all route endpoints
        this.ctx.set('x-custom-header', 'custom-header-value');
    }

    @Get({
        path: '/hello'
    })
    async hello() {
        // headers after request to this endpoint will include modified headers
        return { message: '👋 Hello' };
    }
}
```

## Ignore after hook execution for endpoint paths

You can configure after hooks to ignore a list of paths to ignore, which means their handler won't be executed for such endpoints.

```ts
export class MyRouter extends Router {

    @AfterHook({
        ignorePaths: [
            'status'
        ]
    })
    async setHeaders() {
        // this will be executed for all route endpoints
        this.ctx.set('x-custom-header', 'custom-header-value');
    }

    @Get({
        path: '/hello'
    })
    async hello() {
        // headers after request to this endpoint will include modified headers
        return { message: '👋 Hello' };
    }

    @Get({
        path: 'status'
    })
    async status() {
        // the after hook `setHeaders` won't execute after requests to this endpoint
        return { ok: true };
    }
}
```
