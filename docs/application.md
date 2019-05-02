# Application Container

ubio Microservices Framework uses [Inversion of Control](https://en.wikipedia.org/wiki/Inversion_of_control) (IoC) to organize operational modules (i.e. modules which _do_ stuff as opposed to entities which mostly carry and present data around such modules).

IoC allows us to achieve loose coupling which helps with keeping modules more focused and simplifies some aspects of unit testing.

To achieve IoC we use [Dependency Injection](https://en.wikipedia.org/wiki/Dependency_injection) library called [Inversify](https://github.com/inversify/InversifyJS) along with some additional guidelines. It is strongly encouraged to familiarize with the essentials of IoC/DI before moving on.

## Modules, Interfaces, Service Identifiers

In Inversify components refer to each other via so-called "service identifiers":

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

> Think of service identifiers as "keys" of imaginary Map, which associates it with an implementation.

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

## FAQ

Q: Should I make every class injectable and inject them instead of passing around as parameters.

A: No. Consider following example, which defines a contract of imaginary request authentication service which is supposed to throw an error if current request does not contain valid authentication data:

```ts
@injectable()
export abstract class AuthService {
    @inject(Logger)
    logger!: Logger;

    abstract async authenticate(ctx: Context): Promise<void>;
}
```

Here `ctx` is already injectable using `'KoaContext'` (string) as part of the framework. So _technically_ it is possible to write it like this:

```ts
@injectable()
export abstract class AuthService {
    @inject(Logger)
    logger!: Logger;
    @inject('KoaContext')
    ctx!: Context;

    abstract async authenticate(): Promise<void>;
}
```

Now let's focus only on a single aspect of this module: a contract defined by `authenticate()` method.

```ts
abstract async authenticate(): Promise<void>;
```

Does such a contract provide enough data for the potential implementors? What exactly should they authenticate?

Obviously, `ctx` here is _input data_ to the method, as opposed to a _dependency_, and must be included in the contract itself. It is also possible to further refine this contract by changing the signature of `authenticate` method so that it accepts `request: koa.Request` instead of more broad `ctx: koa.Context`.

---

Q: How do I make request-bound logger in a singleton (e.g. a database driver)?

A: You can't, because those two modules have incompatible lifecycle (in other words, modules shouldn't live longer than their dependencies). So singletons should only receive application-scoped logger which doesn't include request details.

Instead, consider creating a Repository module which will have shorter life span (thus compatible to request logger) and can still depend on a singleton database driver.

