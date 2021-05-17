import cors from '@koa/cors';
import http from 'http';
import https from 'https';
import { Container, inject, injectable } from 'inversify';
import Koa, { Middleware } from 'koa';
import bodyParser from 'koa-body';
import compress from 'koa-compress';
import conditional from 'koa-conditional-get';
import etag from 'koa-etag';
import stoppable, { StoppableServer } from 'stoppable';

import { AcAuth } from './ac-auth';
import { FrameworkEnv } from './env';
import { ClientError } from './exception';
import { Logger, RequestLogger } from './logger';
import * as middleware from './middleware';
import { Router } from './router';
import { AcAuthProvider } from './services';

@injectable()
export class HttpServer extends Koa {
    server: StoppableServer | null = null;

    constructor(
        @inject(Logger)
        protected logger: Logger,
        @inject('RootContainer')
        protected rootContainer: Container,
        @inject(FrameworkEnv)
        protected frameworkEnv: FrameworkEnv, // env is used by Koa
    ) {
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

    addStandardMiddleware(): this {
        this.use(async (ctx, next) => {
            ctx.compress = false;
            await next();
        });
        this.use(
            compress({
                threshold: 2048,
                gzip: {
                    flush: require('zlib').constants.Z_SYNC_FLUSH,
                },
                deflate: {
                    flush: require('zlib').constants.Z_SYNC_FLUSH,
                },
            })
        );
        this.use(this.createRequestContainerMiddleware());
        this.use(bodyParser({
            json: true,
            urlencoded: true,
            multipart: true,
            jsonLimit: this.frameworkEnv.HTTP_JSON_LIMIT,
            formLimit: this.frameworkEnv.HTTP_FORM_LIMIT,
            formidable: {
                maxFileSize: this.frameworkEnv.HTTP_MAX_FILE_SIZE_BYTES,
            }
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
        this.use(this.createAcAuthMiddleware());
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

    protected createRequestContainerMiddleware(): Middleware {
        return async (ctx: Koa.Context, next: Koa.Next) => {
            const requestContainer = new Container({ skipBaseClassChecks: true });
            requestContainer.parent = this.rootContainer;
            requestContainer.bind('KoaContext').toConstantValue(ctx);
            requestContainer.bind(Logger).to(RequestLogger).inSingletonScope();
            ctx.container = requestContainer;
            ctx.logger = requestContainer.get<Logger>(Logger);
            return next();
        };
    }

    protected createAcAuthMiddleware(): Middleware {
        return async (ctx: Koa.Context, next: Koa.Next) => {
            const container: Container = ctx.container;
            const provider = container.get(AcAuthProvider);
            const acAuth = await provider.provide();
            container.bind(AcAuth).toConstantValue(acAuth);
            return next();
        };
    }

    protected createRoutingMiddleware(): Middleware {
        return async (ctx: Koa.Context) => {
            const container: Container = ctx.container;
            const routers = container.getAll<Router>(Router);
            for (const router of routers) {
                const handled = await router.handle();
                if (handled) {
                    return;
                }
            }
            throw new RouteNotFoundError();
        };
    }

}

export class RouteNotFoundError extends ClientError {
    status = 404;
    message = 'Route not found';
}
