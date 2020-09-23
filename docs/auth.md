# Auth service

You can use `AutomationCloudAuthService` to authenticate requests made to automation cloud, It will decode anf verify the auth header injected by Gateway - header name is configured as `process.env.AC_AUTH_HEADER_NAME`) if presented, or it will forward the auth header(`authorization`) to s-api if not presented(for backward compatibility). if none of them is provided, it will not check any auth. for this reason, it is highly recommended for you to add additional `this.acContext.checkAuthenticated()` from your router's middleware.

`AutomationCloudAuthService` is bound to base Application so you won't need to bind it to your application.

> `AuthService` and `ForwardRequestAuthService` are deprecated. You'd want to unbind them to migrate to the new auth service.

The authentication (`RequestAuthService.check(ctx)`) is checked behind the scene in the middleware defined in [HttpServer](../src/main/http.ts). To confirm and use the state of authentication, you can check the Router property `acContext`. For example, if you want your custom middleware to check the authenticated request only, you can call `await this.acContext.checkAuthenticated()` so that non-authenticated request will be rejected with 401 error. If you'd like your endpoint to accepts a requests contains organisation information, you can call `this.acContext.requireOrganisationId()` this will return organisationId, and throws when organisationId is not parsed from auth payload.


```ts
// src/main/routes/my-router.ts

@injectable()
export class MyRouter extends Router {
    constructor(
        @inject(AutomationCloudContext)
        acContext: AutomationCloudContext
    )

    @Middleware()
    async authorise() {
        // throws 401 when not authenticated
        await this.acContext.checkAuthenticated();
    }

    @Get({
        path: '/Hello/organisationId',
        summary: 'I need organisationId from the user',
    })
    async helloOrg() {
        // it throws 403 when organisationId not found from acContext
        const organisationId = this.acContext.requireOrganisationId();
        return { message: '👋hello ' + organisationId };
    }

    @Get({
        path: '/Hello/serviceAccountId',
        summary: 'I need some other info from decoded jwt',
    })
    async helloServiceAccount() {
        // it throws 403 when serviceAccount info is not found in acContext
        const serviceAccountId = this.acContext.requireServiceAccountId();
        return { message: '👋hello ' + serviceAccountId };
    }
```
