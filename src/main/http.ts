import { Logger } from '@flexent/logger';
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
import { constants } from 'zlib';

import { AcAuth } from './ac-auth.js';
import { Config, config } from './config.js';
import { ClientError } from './exception.js';
import { RequestLogger } from './logger.js';
import * as middleware from './middleware/index.js';
import { Router } from './router.js';
import { AcAuthProvider } from './services/index.js';


interface MiddlewareSpec {
    name: string;
    middleware: Middleware;
}


@injectable()
export class HttpServer extends Koa {
    server: StoppableServer | null = null;

    @config({ default: 8080 }) PORT!: number;
    @config({ default: '5mb' }) HTTP_JSON_LIMIT!: string;
    @config({ default: '10mb' }) HTTP_TEXT_LIMIT!: string;
    @config({ default: '1mb' }) HTTP_FORM_LIMIT!: string;
    @config({ default: 50 * 1024 * 1024 }) HTTP_MAX_FILE_SIZE_BYTES!: number;
    @config({ default: false }) HTTP_INCLUDE_UNPARSED_BODY!: boolean;
    @config({ default: 10000 }) HTTP_SHUTDOWN_DELAY!: number;
    @config({ default: 300000 }) HTTP_TIMEOUT!: number;

    protected middlewares: MiddlewareSpec[] = [
        {
            name: 'preCompress',
            middleware: async (ctx, next) => {
                ctx.compress = false;
                await next();
            },
        },
        {
            name: 'compress',
            middleware: compress({
                threshold: 2048,
                gzip: {
                    flush: constants.Z_SYNC_FLUSH,
                },
                deflate: {
                    flush: constants.Z_SYNC_FLUSH,
                },
            }),
        },
        {
            name: 'requestContainer',
            middleware: this.createRequestContainerMiddleware(),
        },
        {
            name: 'bodyParser',
            middleware: bodyParser({
                json: true,
                urlencoded: true,
                multipart: true,
                jsonLimit: this.HTTP_JSON_LIMIT,
                textLimit: this.HTTP_TEXT_LIMIT,
                formLimit: this.HTTP_FORM_LIMIT,
                formidable: {
                    maxFileSize: this.HTTP_MAX_FILE_SIZE_BYTES,
                },
                includeUnparsed: this.HTTP_INCLUDE_UNPARSED_BODY
            })
        },
        {
            name: 'conditional',
            middleware: conditional()
        },
        {
            name: 'etag',
            middleware: etag()
        },
        {
            name: 'cors',
            middleware: cors({
                exposeHeaders: ['Date', 'Content-Length'],
                maxAge: 15 * 60
            })
        },
        {
            name: 'requestLog',
            middleware: middleware.requestLog,
        },
        {
            name: 'requestId',
            middleware: middleware.requestId,
        },
        {
            name: 'responseTime',
            middleware: middleware.responseTime,
        },
        {
            name: 'errorHandler',
            middleware: middleware.errorHandler,
        },
        {
            name: 'acAuth',
            middleware: this.createAcAuthMiddleware(),
        },
        {
            name: 'routing',
            middleware: this.createRoutingMiddleware(),
        }
    ];

    constructor(
        @inject('RootContainer')
        protected rootContainer: Container,
        @inject(Logger)
        protected logger: Logger,
        @inject(Config)
        public config: Config, // env is used by Koa
    ) {
        super();
        this.proxy = true;
        this.addStandardMiddleware();
    }

    addStandardMiddleware(): this {
        this.middlewares.forEach(m => this.use(m.middleware));

        return this;
    }

    async startServer() {
        if (this.server) {
            return;
        }
        const port = this.PORT;
        const server = stoppable(http.createServer(this.callback()), this.HTTP_TIMEOUT);
        this.server = server;
        this.server.setTimeout(this.HTTP_TIMEOUT);
        server.listen(port, () => {
            this.logger.info(`Listening on ${port}`);
        });
    }

    async startHttpsServer(options: https.ServerOptions = {}) {
        if (this.server) {
            return;
        }
        const port = this.PORT;
        const server = stoppable(https.createServer(options, this.callback()), this.HTTP_TIMEOUT);
        this.server = server;
        this.server.setTimeout(this.HTTP_TIMEOUT);
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
            await new Promise(r => setTimeout(r, this.HTTP_SHUTDOWN_DELAY));
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
    override status = 404;
    override message = 'Route not found';
}
