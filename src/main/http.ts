import Koa, { Middleware, Context } from 'koa';
import { Container, injectable, inject } from 'inversify';
import { RequestLogger } from './logger';
import { Router } from './router';
import http from 'http';
import https from 'https';
import stoppable, { StoppableServer } from 'stoppable';
import bodyParser from 'koa-bodyparser';
import conditional from 'koa-conditional-get';
import etag from 'koa-etag';
import cors from '@koa/cors';
import * as middleware from './middleware';
import { Exception, Logger, Configuration, numberConfig } from '@ubio/essentials';

const PORT = numberConfig('PORT', 8080);
const HTTP_TIMEOUT = numberConfig('HTTP_TIMEOUT', 300000);

@injectable()
export class HttpServer extends Koa {
    @inject(Logger)
    logger!: Logger;
    @inject(Configuration)
    config!: Configuration;
    @inject('RootContainer')
    rootContainer!: Container;

    container: Container;
    server: StoppableServer | null = null;

    constructor() {
        super();
        this.proxy = true;
        this.addStandardMiddleware();
        this.container = new Container({ skipBaseClassChecks: true });
        // Note: rootContainer is unavailable here, so we'll plug it into container's parent later
    }

    getPort() {
        return this.config.get(PORT);
    }

    getTimeout() {
        return this.config.get(HTTP_TIMEOUT);
    }

    createRoutingMiddleware(): Middleware {
        return async (ctx: Context) => {
            // Request container injects 'KoaContext' (by string!)
            // and overrides Logger with RequestLogger.
            this.container.parent = this.rootContainer;
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

    async startServer() {
        if (this.server) {
            return;
        }
        const port = this.getPort();
        const server = stoppable(http.createServer(this.callback()), 10000);
        this.server = server;
        this.server.setTimeout(this.getTimeout());
        server.listen(port, () => {
            this.logger.info(`Listening on ${port}`);
        });
    }

    async startHttpsServer(options: https.ServerOptions = {}) {
        if (this.server) {
            return;
        }
        const port = this.getPort();
        const server = stoppable(https.createServer(options, this.callback()), 10000);
        this.server = server;
        this.server.setTimeout(this.getTimeout());
        server.listen(port, () => {
            this.logger.info(`Listening on ${port}`);
        });
    }

    async stopServer() {
        const server = this.server;
        if (!server) {
            return;
        }
        try {
            if (process.env.NODE_ENV === 'production') {
                this.logger.info(`Graceful shutdown: wait for traffic to stop being sent`);
                await new Promise(r => setTimeout(r, 10000));
            }
            this.logger.info('Graceful shutdown: stop accepting new requests, wait for existing requests to finish');
            if (process.env.NODE_ENV === 'production') {
                await new Promise(r => server.stop(r));
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
