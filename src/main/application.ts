import { Container } from 'inversify';
import { RequestFactory } from './request';
import { Logger, StandardLogger, Configuration } from '@ubio/essentials';
import { EnvConfiguration } from './config';
import { HttpServer } from './http';
import { AnyConstructor } from './util';
import { MetricsRouter } from './metrics/route';
import { Router } from './router';
import { MetricsRegistry } from './metrics';
import { getGlobalMetrics } from './metrics/global';

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
        // Some default implementations are bound for convenience but can be replaced as fit
        this.container.bind('RootContainer').toConstantValue(container);
        this.container.bind(HttpServer).toSelf().inSingletonScope();
        this.container.bind(Logger).to(StandardLogger).inSingletonScope();
        this.container.bind(Configuration).to(EnvConfiguration).inSingletonScope();
        this.container.bind(RequestFactory).toSelf();
        this.container.bind(Router).to(MetricsRouter);
        this.container.bind(MetricsRegistry).toConstantValue(getGlobalMetrics());
    }

    get logger(): Logger {
        return this.container.get(Logger);
    }

    get config(): Configuration {
        return this.container.get(Configuration);
    }

    get httpServer(): HttpServer {
        return this.container.get(HttpServer);
    }

    async beforeStart(): Promise<void> {}
    async afterStop(): Promise<void> {}

    /**
     * A shortcut to bind a singleton.
     * Only use that to bind components which maintain application-wide state like
     * database connection pools. Note: it won't be possible to inject request-scoped
     * components into application-scoped ones (which is quite obvious limitation).
     */
    bindSingleton(serviceIdentifier: any, impl: AnyConstructor = serviceIdentifier) {
        if (this.container.isBound(serviceIdentifier)) {
            this.container.rebind(serviceIdentifier).to(impl).inSingletonScope();
        } else {
            this.container.bind(serviceIdentifier).to(impl).inSingletonScope();
        }
        return this;
    }

    /**
     * A shortcut for binding/rebinding-if-exists a module to IoC container.
     * A service identifier is typically a class, and a typically usage is to simply
     * bind a constructor to itself. When necessary (e.g. tests) you can rebind
     * a different implementation to this constructor,
     * in this case supply it as a second parameter.
     */
    bind(constructor: any, impl: AnyConstructor = constructor): this {
        if (this.container.isBound(constructor)) {
            this.container.rebind(constructor).to(impl);
        } else {
            this.container.bind(constructor).to(impl);
        }
        return this;
    }

    /**
     * Binds all specified implementation classes to `constructor`.
     * Use `@multiInject` to resolve them.
     */
    bindAll(constructor: any, impls: AnyConstructor[]): this {
        for (const impl of impls) {
            this.container.bind(constructor).to(impl);
        }
        return this;
    }

    /**
     * Unbinds all (if any) implementations previously bound to `constructor`.
     */
    unbind(contrstructor: any): this {
        if (this.container.isBound(contrstructor)) {
            this.container.unbind(contrstructor);
        }
        return this;
    }

    bindMetrics(constructor: (new(...args: any[]) => MetricsRegistry)): this {
        // Metrics registries should be bound in singleton scope,
        // and same instances must be appended to MetricsRegistry bindings
        this.container.bind(constructor).toSelf().inSingletonScope();
        this.container.bind(MetricsRegistry).toService(constructor);
        return this;
    }

    async start() {
        process.on('SIGTERM', () => this.stop());
        process.on('SIGINT', () => this.stop());
        await this.beforeStart();
    }

    async stop() {
        // TODO uninstall process signals handlers better
        process.removeAllListeners();
        await this.afterStop();
    }

}
