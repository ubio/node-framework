# Automation Cloud Authentication & Authorisation

Automation Cloud infrastructure features highly sophisticated request authentication system.

Node Framework does its best to abstract away all the complexity, allowing apps to focus on what they are supposed to be doing.

`AcAuth` object exposes identity information of current request, as well as convenience methods for request authorisation.

```ts
export class MyRouter extends Router {

    @dep() auth!: AcAuth;

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
        const organisationId = this.auth.requireOrganisationId();
        return { message: '👋 Hello ' + organisationId };
    }

    @Get({
        path: '/Hello/serviceAccountId',
        summary: 'I need some other info from decoded jwt',
    })
    async helloServiceAccount() {
        // throws 403 when serviceAccount info cannot be extracted from request details
        const serviceAccountId = this.auth.requireServiceAccountId();
        return { message: '👋 Hello ' + serviceAccountId };
    }
}
```

## Mocking auth in tests

In integration tests it is useful to mock `AcAuth` by providing a custom implementation of `AcAuthProvider`:

```ts
class App extends Application {

    override defineHttpRequestScope(mesh: Mesh) {
        mesh.constant(AcAuthProvider, {
            async provide() {
                return new AcAuth({
                    authenticated: true,
                    organisationId: 'my-fake-org-id',
                    serviceAccountId: 'my-face-service-account-id',
                });
            }
        });
    }

}
```

Please refer to [integration tests](../src/test/integration/ac-auth-mocking.test.ts) for an example.
