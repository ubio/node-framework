# Automation Cloud Authentication & Authorisation

**Note: there are known problems with the auth, it needs to be re-designed. Use this guide at your own risk.**

Automation Cloud infrastructure features "highly sophisticated" request authentication system.

Node Framework does its best to abstract away all the complexity, allowing apps to focus on what they are supposed to be doing.

The framework exports a default implementation of auth provider for Automation Cloud. Although, (starting from version 16.x) this service is optional and needs explicity installation (including its dependencies, i.e. a JWT service).

```ts
class App extends Application {

    override createGlobalScope() {
        // starting from version 16.x, the following lines are required to use AC auth (default) service implementation
        const mesh = super.createGlobalScope();
        mesh.service(AuthProvider, AcAuthProvider);
        mesh.service(JwtService, AutomationCloudJwtService);
    }
}
```

`AuthContext<AuthToken>` object exposes identity information of current request, as well as convenience methods for request authorisation.

`AuthToken` object type is based on the implementation of the `AuthProvider` registered. You may specify any auth token object type, i.e `AuthContext<AcAuth>`. In order to retrieve specific data from a auth token type, you need to retrieve it from the auth context object with `authContenxt.getToken()`.

```ts
export class MyRouter extends Router {

    @dep() auth!: AuthContext<AcAuth>;

    @Middleware()
    async authorise() {
        // throws 401 when not authenticated (anonymous)
        this.auth.checkAuthenticated();
    }

    @Get({
        path: '/Hello/organisationId',
        summary: 'I need organisationId from the user',
    })
    async helloOrg() {
        // throws 403 when organisationId cannot be extracted from request details
        const organisationId = this.auth.getAuthToken().requireOrganisationId();
        return { message: '👋 Hello ' + organisationId };
    }

    @Get({
        path: '/Hello/serviceAccountId',
        summary: 'I need some other info from decoded jwt',
    })
    async helloServiceAccount() {
        // throws 403 when serviceAccount info cannot be extracted from request details
        const serviceAccountId = this.auth.getAuthToken().requireServiceAccountId();
        return { message: '👋 Hello ' + serviceAccountId };
    }
}
```

## Mocking auth in tests

In integration tests it is useful to mock `AuthContext` by providing a custom implementation of `AcAuthProvider`:

```ts
class App extends Application {

    override createGlobalScope() {
        const mesh = super.createGlobalScope();
        mesh.constant(AcAuthProvider, {
            async provide() {
                return new AuthContext(
                    new AcAuth({
                        authenticated: true,
                        organisationId: 'my-fake-org-id',
                        serviceAccountId: 'my-face-service-account-id',
                    })
                );
            }
        });
        return mesh;
    }

}
```

Please refer to [integration tests](../src/test/integration/ac-auth-mocking.test.ts) for an example.
