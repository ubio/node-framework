import Koa, { Middleware, Context } from 'koa';
import { Container, ContainerModule } from 'inversify';
import { Logger, RequestLogger } from './logger';
import { Router, RouterConstructor } from './router';
import { createServer } from 'http';
import stoppable, { StoppableServer } from 'stoppable';
import bodyParser from 'koa-bodyparser';
import * as middleware from './middleware';
import { Constructor } from './util';

type AsyncFn = () => Promise<any>;

export class Application extends Koa {
    container: Container;
    server: StoppableServer | null = null;
    logger: Logger;
    startHooks: AsyncFn[] = [];
    stopHooks: AsyncFn[] = [];

    constructor() {
        super();
        const container = new Container({ skipBaseClassChecks: true });
        this.container = container;
        this.proxy = true;
        process.once('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
        process.once('SIGINT', () => this.gracefulShutdown('SIGINT'));
        this.bindSingleton(Logger);
        this.logger = container.get<Logger>(Logger);
    }

    /**
     * A shortcut to register a router class in IoC container.
     * Standard routing middleware uses Router constructor
     * as a service identifier for enlisting all routes, so this
     * method simply enforces this convention.
     */
    bindRouter(routerClass: RouterConstructor): this {
        this.container.bind(Router).to(routerClass);
        return this;
    }

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

    createRoutingMiddleware(): Middleware {
        return async (ctx: Context, next: () => Promise<any>) => {
            // Request container injects 'KoaContext' (by string!)
            // and overrides Logger with RequestLogger.
            const requestContainer = new Container({ skipBaseClassChecks: true });
            requestContainer.parent = this.container;
            requestContainer.bind('KoaContext').toConstantValue(ctx);
            requestContainer.bind(Logger).to(RequestLogger).inRequestScope();
            ctx.container = requestContainer;

            const routers = requestContainer.getAll<Router>(Router);
            for (const router of routers) {
                const handled = await router.handle();
                if (handled) {
                    return;
                }
            }

            throw new RouteNotFoundError();
        };
    }

    addStandardMiddleware(): this {
        this.use(bodyParser({
            enableTypes: ['json']
        }));
        this.use(middleware.requestId);
        this.use(middleware.responseTime);
        this.use(middleware.errorHandler);
        this.use(this.createRoutingMiddleware());
        return this;
    }

    beforeStart(asyncFn: AsyncFn): this {
        this.startHooks.push(asyncFn);
        return this;
    }

    afterStop(asyncFn: AsyncFn): this {
        this.stopHooks.push(asyncFn);
        return this;
    }

    async start(port: number) {
        const server = stoppable(createServer(this.callback()), 10000);
        this.server = server;
        for (const asyncFn of this.startHooks) {
            await asyncFn();
        }
        server.listen(port, () => {
            this.logger.info(`Listening on ${port}`);
        });
    }

    async stop() {
        const server = this.server;
        if (!server) {
            return;
        }
        process.removeAllListeners();
        await new Promise(r => server.stop(r));
        for (const asyncFn of this.stopHooks) {
            await asyncFn();
        }
    }

    async gracefulShutdown(signal: string) {
        const server = this.server;
        if (!server) {
            return;
        }
        try {
            if (process.env.NODE_ENV !== 'test') {
                this.logger.info(`Graceful shutdown: received ${signal}, wait for traffic to stop being sent`);
                await new Promise(r => setTimeout(r, 10000));
            }
            this.logger.info('Graceful shutdown: stop accepting new requests, wait for existing requests to finish');
            await this.stop();
            this.logger.info('Graceful shutdown: complete');
        } catch (error) {
            this.logger.error('Graceful shutdown failed', { error });
            process.exit(1);
        }
    }

    // Experimental
    generateEndpointDocs() {
        const container = new Container({ skipBaseClassChecks: true });
        container.parent = this.container;
        container.bind('KoaContext').toConstantValue({});
        const routers = container.getAll<Router>(Router);
        const doc = {
            // TODO add more info
            paths: {}
        };
        for (const router of routers) {
            Object.assign(doc.paths, router.generateDocs());
        }
        return doc;
    }

}

export class RouteNotFoundError extends Error {
    status: number = 404;
}
