# Application Container

ubio Microservices Framework uses [Inversion of Control](https://en.wikipedia.org/wiki/Inversion_of_control) (IoC) to organize operational modules (i.e. modules which _do_ stuff as opposed to entities which mostly carry and present data around such modules).

IoC allows us to achieve loose coupling which helps with keeping modules more focused and simplifies some aspects of unit testing.

To achieve IoC we use [Dependency Injection](https://en.wikipedia.org/wiki/Dependency_injection) library called [Inversify](https://github.com/inversify/InversifyJS) along with some additional guidelines. It is strongly encouraged to familiarize with the essentials of IoC/DI before moving on.

## Modules, Interfaces, Service Identifiers

In Dependency Injection components refer to each other via so-called "service identifiers":

```ts
import { Logger } from '@ubio/framework';

@injectable()
export class MyService {
    @inject(Logger)
    logger!: Logger;

    myMethod() {
        this.logger.info('Hello');
    }
}
```

In this example `MyService` declares `logger` as its dependency. `@inject(Logger)` decorator specifies that this dependency must be resolved by *service identifier* `Logger` (which happens to be an `abstract class`). Inversify also supports String and Symbol service identifiers, but we prefer using constructors.

Again, `Logger` here acts both as a service identifier and an "interface" which declares logging methods like `.info(...)`. The actual implementation of such methods is unknown to `MyService`, which makes these two components loosely coupled.

> Note: TypeScript `interface` cannot be used as a service identifier, because it is erased by the compiler and thus is not available in runtime. Instead, we use `abstract class` both as a "module interface" (which describes its contract) and as a service identifier to bind implementations.

## Composition Root

The service identifiers are wired with implementations in a single place called _composition root_. By convention each application should have their composition root defined in `src/main/app.ts`:

```ts
import { Application } from './framework';

export function createApp() {
    const app = new Application();
    // Bind Logger service identifier to MyLogger class
    app.bind(Logger, MyLogger);
    // Bind MyService service identifier to the same MyService class
    app.bind(MyService);
    // Bind everything else
    // ...
    return app;
}
```

When the wiring is done, you can request an instance of any service from application container:

```ts
const app = createApp();
const myService = app.container.get<MyService>(MyService);
// myService instance is created by Application, and all its dependencies are satisfied
myService.myMethod();
// will call MyLogger#info with "hello" argument
```

Important note: most of the times you do not need to call `app.container.get` directly.
The reason for that is: entry point for http-server microservices code will be routers, which
are already instantiated by application container. Accessing `app.container` directly from injectable modules is discouraged and widely considered an anti-pattern.

## Module Scopes

Most application modules will have _transient_ scope. This means that container will instantiate modules like `MyService` every time they are injected, and will not try to reuse them.

The reason for this default arrangement is to discourage modules from having shared state and relying on it. A notable exception is `logger` which is bound to request scope and therefore will include context data like `requestId` from whatever module calls it.

For some modules that maintain application-wide state (e.g. database connections) this arrangement is not suitable, so these modules must be bound using `bindSingleton` method:

```ts
app.bindSingleton(MongoDb);
```

Signletons (for obvious reasons) cannot inject the request scoped modules. As such, the use of singletons should be reduced to minimum, with valid known-so-far use cases being database connectivity modules.

> Note: if you desperately need to share state across modules, there's a couple of approaches to consider before trying to "convince" the container to reuse the same instance. Please escalate the issue to team leads, and we will figure out the proper solution together.



