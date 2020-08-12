# Auth service

You can use `AutomationCloudAuthService` to authenticate requests made to automation cloud, It will try to parse the header injected by Gateway, then try to forward the auth header to s-api if the header is not present(for backward compatibility).

The class should be bound to application container, also `AutomationCloudJwt` should be bound as a singleton(to use jwks cache properly).

## Example
```ts
// src/main/routes/my-router.ts
import {
    Application,
    AuthService,
    AutomationCloudAuthService,
    Jwt,
    AutomationCloudJwt,
} from '@ubio/framework';

export class App extends Application {

    constructor() {
        super();
        this.container.bind(Jwt).to(AutomationCloudJwt).inSingletonScope();
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
Keep in mind that organisationId is _not_ always available (It will not be available if authenticated by forwarding auth header, the traditional way)
