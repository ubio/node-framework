# Application Container

Ubio Node.js Framework uses [Inversion of Control](https://en.wikipedia.org/wiki/Inversion_of_control) (IoC) to organize application components.

IoC allows us to achieve loose coupling which helps with keeping modules more focused and simplifies some aspects of unit testing.

To achieve IoC we use library called [Mesh](https://github.com/MeshIoC/mesh-ioc) along with some additional guidelines. Be sure to check out the [Mesh Readme](https://github.com/MeshIoC/mesh-ioc#readme) as it covers a lot on the IoC topic. It is strongly encouraged to get familiar with the essentials of IoC/DI before moving on.

## Modules, Interfaces, Service Identifiers

Mesh allows modules to refer to each other by means of declaring a class property with `@dep` decorator.

```ts
import { Logger } from '@ubio/framework';

export class MyService {

    @dep() logger!: Logger;

    myMethod() {
        this.logger.info('Hello');
    }
}
```

In this example `MyService` declares `logger` as its dependency. `@dep()` decorator specifies that this dependency must be resolved by *a service identifier* `Logger`, which is inferred from the property type (in our example `Logger` also happens to be an `abstract class`).

> Think of service identifiers as keys of a Map that associates it with an implementation.

Again, `Logger` here acts both as a service identifier and an "interface" which declares logging methods like `.info(...)`. The actual implementation of such methods is unknown to `MyService`, which makes these two components loosely coupled.

> Note: TypeScript `interface` cannot be used as a service identifier, because it is erased by the compiler and thus is not available in runtime. Instead, we use `abstract class` both as a "module interface" (which describes its contract) and as a service identifier to bind implementations.

## Composition Root

The service identifiers are wired with implementations in a single place called _composition root_.
By convention each application should have their composition root defined in `src/main/app.ts`:

```ts
import { Application } from './framework';

export class App extends Application {

    createGlobalScope() {
        const mesh = super.createGlobalScope();
        // Bind Logger service identifier to MyLogger class
        mesh.service(Logger, MyLogger);
        // Bind MyService service identifier to the same MyService class
        mesh.service(MyService);
        return mesh;
    }
}
```

`Mesh` instance above acts as an IoC container. It maps service identifiers to service constructors.

When the wiring is done, you can request an instance of any service from application mesh:

```ts
const app = new App();
const myService = app.mesh.resolve(MyService);
// myService instance is created by Application, and all its dependencies are resolved from the same mesh
myService.myMethod();
// will call MyLogger#info with "hello" argument
```

## Scopes

Application components are organised into two scopes:

    - **Global**: these components are effectively singletons and are instantiated only once per application instance.
    - **HttpRequest:** these components are instantiated on each HTTP request and only live for the duration of a single request-response cycle.

Note: scope simply refers to and individual `Mesh` instance. For example, when request is processed by the Http Server, it creates an http request scope mesh and does the route matching there. All global-scoped components are available in http-scoped components, but not the other way around.

When application is processing HTTP requests, a number of request-scoped components can be bound to Router classes:

- `AcAuth` (Automation Cloud identity and authorisation data)
- `KoaContext` (bound by string `"KoaContext"` service identifier) — [Koa](https://koajs.org) context object
- `Logger` (rebound to `RequestLogger`) which includes request-specific data
