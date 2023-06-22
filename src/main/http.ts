import cors from '@koa/cors';
import { config } from '@nodescript/config';
import { Logger, LogLevel } from '@nodescript/logger';
import http from 'http';
import https from 'https';
import Koa, { Middleware } from 'koa';
import bodyParser from 'koa-body';
import compress from 'koa-compress';
import conditional from 'koa-conditional-get';
import etag from 'koa-etag';
import { dep, Mesh } from 'mesh-ioc';
import stoppable, { StoppableServer } from 'stoppable';
import { constants } from 'zlib';

import { AcAuth } from './ac-auth.js';
import { ClientError } from './exception.js';
import { standardMiddleware } from './middleware.js';
import { Router } from './router.js';
import { AcAuthProvider } from './services/index.js';
import { findMeshInstances } from './util.js';

interface MiddlewareSpec {
    name: string;
    middleware: Middleware;
}

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
    @config({ default: true }) HTTP_USE_BROTLI_COMPRESSION!: boolean;

    @dep() protected logger!: Logger;
    @dep({ key: 'httpRequestScope' })
    protected createRequestScope!: () => Mesh;

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
                br: this.HTTP_USE_BROTLI_COMPRESSION ? undefined : false
            }),
        },
        {
            name: 'requestContainer',
            middleware: this.createRequestScopeMiddleware(),
        },
        {
            name: 'standard',
            middleware: standardMiddleware,
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
            name: 'acAuth',
            middleware: this.createAcAuthMiddleware(),
        },
        {
            name: 'routing',
            middleware: this.createRoutingMiddleware(),
        }
    ];

    constructor() {
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

    protected createRequestScopeMiddleware(): Middleware {
        return async (ctx: Koa.Context, next: Koa.Next) => {
            const mesh = this.createRequestScope();
            mesh.constant('KoaContext', ctx);
            ctx.mesh = mesh;
            ctx.logger = mesh.resolve(Logger);
            return next();
        };
    }

    protected createAcAuthMiddleware(): Middleware {
        return async (ctx: Koa.Context, next: Koa.Next) => {
            const mesh: Mesh = ctx.mesh;
            const provider = mesh.resolve(AcAuthProvider);
            const acAuth = await provider.provide(ctx.headers);
            mesh.constant(AcAuth, acAuth);
            return next();
        };
    }

    protected createRoutingMiddleware(): Middleware {
        return async (ctx: Koa.Context) => {
            const routers = this.findAllRoutes(ctx.mesh);
            for (const router of routers) {
                const handled = await router.handle();
                if (handled) {
                    return;
                }
            }
            throw new RouteNotFoundError();
        };
    }

    protected findAllRoutes(mesh: Mesh) {
        return findMeshInstances(mesh, Router);
    }

}

export class RouteNotFoundError extends ClientError {
    override status = 404;
    override message = 'Route not found';
}

export class HttpRequestLogger extends Logger {

    @dep({ key: 'KoaContext' }) protected ctx!: Koa.Context;
    @dep({ key: 'AppLogger' }) protected delegateLogger!: Logger;

    constructor() {
        super();
        this.setLevel(this.delegateLogger.level);
    }

    write(level: LogLevel, message: string, data: object): void {
        const { requestId } = this.ctx.state;
        this.delegateLogger.write(level, message, {
            ...data,
            requestId,
        });
    }

}
