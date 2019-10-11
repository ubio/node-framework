import { Container } from 'inversify';
import { Constructor } from './util';
import { RequestFactory } from './request';
import { Logger, StandardLogger } from '@ubio/essentials';

/**
 * Application provides an IoC container where all modules should be registered
 * and provides minimal lifecycle framework (start, stop, beforeStart, afterStop).
 *
 * Note: it is convenient (less typing, fewer possibilities for human errors)
 * for a typical http server application to bind its lifecycle to http server lifecycle,
 * so currently Application combines concerns of both http server and IoC composition root.
 * If this proves problematic in future, we may choose to change that and decouple the two.
 *
 * Despite depending on Koa, Application can run just fine without starting an http server.
 * Simply avoid invoking `app.startServer()` and manage the app lifecycle separately
 * (e.g invoke `app.runStartHooks()` instead of `app.startServer()`).
 */
export class Application {
    container: Container;

    constructor() {
        const container = new Container({ skipBaseClassChecks: true });
        this.container = container;
        this.bindSingleton(Logger, StandardLogger);
        this.bind(RequestFactory);
        // TODO consider adding default environment-based configuration
    }

    get logger(): Logger {
        return this.container.get<Logger>(Logger);
    }

    async beforeStart(): Promise<void> {}
    async afterStop(): Promise<void> {}

    /**
     * A shortcut to bind a singleton.
     * Only use that to bind components which maintain application-wide state like
     * database connection pools. Note: it won't be possible to inject request-scoped
     * components into application-scoped ones (which is quite obvious limitation).
     */
    bindSingleton<T>(constructor: any, impl: Constructor<T> = constructor): this {
        if (this.container.isBound(constructor)) {
            this.container.rebind(constructor).to(impl).inSingletonScope();
        } else {
            this.container.bind(constructor).to(impl).inSingletonScope();
        }
        return this;
    }

    /**
     * A shortcut for binding/rebinding-if-exists a module to IoC container.
     * `constructor` is used a service identifier, and typical usage is to simply
     * bind a constructor to itself. When necessary (e.g. tests) you can rebind
     * a different implementation to this constructor,
     * in this case supply it as a second parameter.
     */
    bind<T>(constructor: any, impl: Constructor<T> = constructor): this {
        if (this.container.isBound(constructor)) {
            this.container.rebind(constructor).to(impl);
        } else {
            this.container.bind(constructor).to(impl);
        }
        return this;
    }

    async start() {
        process.once('SIGTERM', () => this.stop());
        process.once('SIGINT', () => this.stop());
        await this.beforeStart();
    }

    async stop() {
        // TODO uninstall process signals handlers better
        process.removeAllListeners();
        await this.afterStop();
    }

}
