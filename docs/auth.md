# Auth service

You can use `AutomationCloudAuthService` to authenticate requests made to automation cloud, It will decode anf verify the auth header injected by Gateway - header name is configured as `process.env.AC_AUTH_HEADER_NAME`) if presented, or it will forward the auth header(`authorization`) to s-api if not presented(for backward compatibility). if none of them is provided, it will not check any auth. for this reason, it is highly recommended for you to add additional `this.acCotext.checkAuthenticated()` from your router's middleware.

> AuthService is deprecated and replaced by `RequestAuthService`.
> If you were using `ForwardRequestHeaderAuthService`, bind `RequestAuthService` to `AutomationCloudAuthService` instead as described here.

## Example
```ts
// src/main/routes/my-router.ts
import {
    Application,
    RequestAuthService, // previously AuthService
    AutomationCloudAuthService,
} from '@ubio/framework';

export class App extends Application {

    constructor() {
        super();
        this.container.bind(RequestAuthService).to(AutomationCloudAuthService);
        ...
    }
```

The authentication (`RequestAuthService.check(ctx)`) is done behind the scene from the middleware defined in [HttpServer](../src/main/http.ts).


```ts
// src/main/routes/my-router.ts

@injectable()
export class MyRouter extends Router {
    constructor(
        // tip: no need to bind the RequestAuthService
    )

    @Middleware()
    async authorise() {
        // throws when not authenticated
        await this.acContext.checkAuthenticated();
    }

    @Get({
        path: '/Hello/organisationId',
        summary: 'I need organisationId from the user',
    })
    async helloOrg() {
        // it throws 401 when organisationId not found from acContext
        const organisationId = this.acContext.requireOrganisationId();
        return { message: '👋hello ' + organisationId };
    }

    @Get({
        path: '/Hello/jwt',
        summary: 'I need some other info from decoded jwt',
    })
    async helloJwt() {
        // it throws 401 when organisationId not found from acContext
        const jwt = this.acContext.requireJwt();
        const serviceUserName = jwt.context.service_user_id;
        return { message: '👋hello ' + serviceUserName };
    }
```
