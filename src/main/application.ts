import Koa, { Middleware, Context } from 'koa';
import { Container } from 'inversify';
import { Logger, RequestLogger } from './logger';
import { Router, RouterConstructor } from './router';
import { createServer } from 'http';
import stoppable, { StoppableServer } from 'stoppable';
import bodyParser from 'koa-bodyparser';
import conditional from 'koa-conditional-get';
import etag from 'koa-etag';
import cors from '@koa/cors';
import * as middleware from './middleware';
import { Constructor } from './util';
import { RequestFactory } from './request';
import { Exception } from '@ubio/essentials';

type AsyncFn = () => Promise<any>;

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
        this.bind(RequestFactory);
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
        return async (ctx: Context) => {
            // Request container injects 'KoaContext' (by string!)
            // and overrides Logger with RequestLogger.
            const requestContainer = new Container({ skipBaseClassChecks: true });
            requestContainer.parent = this.container;
            requestContainer.bind('KoaContext').toConstantValue(ctx);
            requestContainer.bind(Logger).to(RequestLogger).inSingletonScope();
            ctx.container = requestContainer;
            ctx.logger = requestContainer.get<Logger>(Logger);

            const routers = requestContainer.getAll<Router>(Router);
            for (const router of routers) {
                const handled = await router.handle();
                if (handled) {
                    return;
                }
            }

            throw new Exception({
                name: 'RouteNotFoundError',
                status: 404
            });
        };
    }

    addStandardMiddleware(): this {
        this.use(bodyParser({
            enableTypes: ['json']
        }));
        this.use(conditional());
        this.use(etag());
        this.use(cors({
            exposeHeaders: ['Date', 'Content-Length'],
            maxAge: 15 * 60
        }));
        this.use(middleware.debugRequestLog);
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

    async startServer(port: number) {
        const server = stoppable(createServer(this.callback()), 10000);
        this.server = server;
        await this.runStartHooks();
        server.listen(port, () => {
            this.logger.info(`Listening on ${port}`);
        });
    }

    async stopServer() {
        const server = this.server;
        if (!server) {
            return;
        }
        process.removeAllListeners();
        await new Promise(r => server.stop(r));
        await this.runStopHooks();
    }

    async runStartHooks() {
        for (const asyncFn of this.startHooks) {
            await asyncFn();
        }
    }

    async runStopHooks() {
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
            if (process.env.NODE_ENV === 'production') {
                this.logger.info(`Graceful shutdown: received ${signal}, wait for traffic to stop being sent`);
                await new Promise(r => setTimeout(r, 10000));
            }
            this.logger.info('Graceful shutdown: stop accepting new requests, wait for existing requests to finish');
            if (process.env.NODE_ENV === 'production') {
                await this.stopServer();
            }
            this.logger.info('Graceful shutdown: complete');
        } catch (error) {
            this.logger.error('Graceful shutdown: failed', { error });
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
