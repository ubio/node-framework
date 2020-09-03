# Auth service

You can use `AutomationCloudAuthService` to authenticate requests made to automation cloud, It will try to parse the header injected by Gateway, then try to forward the auth header to s-api if the header is not present(for backward compatibility).
If you were using `ForwardRequestHeaderAuthService`, use `AutomationCloudAuthService` instead (as described here.)


## Example
```ts
// src/main/routes/my-router.ts
import {
    Application,
    AuthService,
    AutomationCloudAuthService,
} from '@ubio/framework';

export class App extends Application {

    constructor() {
        super();
        this.container.bind(AuthService).to(AutomationCloudAuthService);
        ...
    }
```

It is usually used as a middleware, for example:

```ts
// src/main/routes/my-router.ts

@injectable()
export class MyRouter extends Router {
    constructor(
        @inject(AuthService)
        protected authService: AuthService
    )

    @Middleware()
    async authorizeUser() {
        await this.authService.authorize(this.ctx);
        // to get orgId, use this.authService.getOrganisationId;
    }

```
Keep in mind that you need to provide `AC_JWKS_URL`  in your application if you are aiming to use Ubio's AutomationCloud Auth Service (infrastructure).
