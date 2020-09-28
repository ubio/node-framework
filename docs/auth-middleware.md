# Auth

By default, the Application will authenticate requests if one of the expected auth header is provided. If the auth header(`x-ubio-auth`) is provided, It decodes and verify the token with trusted key. Or in case the `authorization` header is present, we will send this header to one of the endpoint of our internal Auth Middleware, and obtain a token which is trusted by the Auth Middleware, and then go through the same decode and verify process. If none of those header is provided, it will not check any auth. for this reason, it is highly recommended for you to call additional `this.acContext.checkAuthenticated()` for the route(s) which requires authentication.

`AuthMiddleware` is bound to base Application so you won't need to bind it to your application.

> since ^5.0.0, `AuthService` and `ForwardRequestAuthService` are deprecated. You'd want to update your application to not bind them.

 To confirm the state of authentication, you may check the Router property `acContext`. For example, if you'd like your custom middleware to check the authenticated request only, you can call `await this.acContext.checkAuthenticated()` so that non-authenticated request will be rejected with 401 error. If you expect the actor to provide the organisationId, you can call `this.acContext.requireOrganisationId()`. It throws 403 when organisationId is not presented. Same applies to `this.acContext.serviceAccountId()` when you expect the actor to be ServiceAccount.

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
