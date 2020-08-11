import Koa, { Middleware, Context } from 'koa';
import { Container, injectable, inject } from 'inversify';
import { Logger, RequestLogger } from './logger';
import { Exception } from './exception';
import { Router } from './router';
import http from 'http';
import https from 'https';
import stoppable, { StoppableServer } from 'stoppable';
import bodyParser from 'koa-bodyparser';
import conditional from 'koa-conditional-get';
import etag from 'koa-etag';
import cors from '@koa/cors';
import * as middleware from './middleware';
import { FrameworkEnv } from './env';

@injectable()
export class HttpServer extends Koa {
    @inject(Logger)
    logger!: Logger;
    @inject('RootContainer')
    rootContainer!: Container;
    @inject(FrameworkEnv)
    frameworkEnv!: FrameworkEnv; // env is used by Koa

    server: StoppableServer | null = null;

    constructor() {
        super();
        this.proxy = true;
        this.addStandardMiddleware();
    }

    getPort() {
        return this.frameworkEnv.PORT;
    }

    getTimeout() {
        return this.frameworkEnv.HTTP_TIMEOUT;
    }

    getShutdownDelay() {
        return this.frameworkEnv.HTTP_SHUTDOWN_DELAY;
    }

    createRoutingMiddleware(): Middleware {
        return async (ctx: Context) => {
            // Request container injects 'KoaContext' (by string!)
            // and overrides Logger with RequestLogger.
            const requestContainer = new Container({ skipBaseClassChecks: true });
            requestContainer.parent = this.rootContainer;
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
                status: 404,
                details: {
                    method: ctx.method,
                    path: ctx.path,
                }
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
        const server = stoppable(http.createServer(this.callback()), this.getTimeout());
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
        const server = stoppable(https.createServer(options, this.callback()), this.getTimeout());
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
        if (process.env.NODE_ENV === 'production') {
            this.logger.info(`Graceful shutdown: wait for traffic to stop being sent`);
            await new Promise(r => setTimeout(r, this.getShutdownDelay()));
        }
        this.logger.info('Graceful shutdown: stop accepting new requests, wait for existing requests to finish');
        await new Promise(r => server.stop(r));
    }

}
