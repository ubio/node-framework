import { Container } from 'inversify';
import { Logger, StandardLogger } from './logger';
import { HttpServer } from './http';
import { MetricsRouter } from './metrics/route';
import { Router } from './router';
import { MetricsRegistry } from './metrics';
import { getGlobalMetrics } from './metrics/global';
import { FrameworkEnv } from './env';
import {
    JwtService,
    AutomationCloudJwtService,
    AutomationCloudAuthService,
    RequestAuthService
} from './services';
import { CustomMiddleware, AuthMiddleware } from './custom-middleware';

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
        this.container.bind(Router).to(MetricsRouter);
        this.container.bind(MetricsRegistry).toConstantValue(getGlobalMetrics());
        this.container.bind(FrameworkEnv).toSelf().inSingletonScope();
        this.container.bind(JwtService).to(AutomationCloudJwtService).inSingletonScope();
        this.container.bind(RequestAuthService).to(AutomationCloudAuthService);
        this.container.bind(CustomMiddleware).to(AuthMiddleware);
    }

    get logger(): Logger {
        return this.container.get(Logger);
    }

    get httpServer(): HttpServer {
        return this.container.get(HttpServer);
    }

    async beforeStart(): Promise<void> {}
    async afterStop(): Promise<void> {}

    bindMetrics(constructor: (new(...args: any[]) => MetricsRegistry)): this {
        // Metrics registries should be bound in singleton scope,
        // and same instances must be appended to MetricsRegistry bindings
        this.container.bind(constructor).toSelf().inSingletonScope();
        this.container.bind(MetricsRegistry).toService(constructor);
        return this;
    }

    bindRouter(constructor: (new(...args: any[]) => Router)): this {
        this.container.bind(Router).to(constructor);
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
