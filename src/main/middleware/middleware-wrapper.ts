import cors from '@koa/cors';
import { Container, inject, injectable } from 'inversify';
import Koa, { Middleware } from 'koa';
import bodyParser from 'koa-body';
import compress from 'koa-compress';
import conditional from 'koa-conditional-get';
import etag from 'koa-etag';

import { AcAuth } from '../ac-auth';
import { Config, config } from '../config';
import { RouteNotFoundError } from '../http';
import { Logger, RequestLogger } from '../logger';
import { Router } from '../router';
import { AcAuthProvider } from '../services';
import * as middleware from './index';


interface MiddlewareSpec {
    name: string,
    middleware: Middleware,
}


@injectable()
export class MiddlewareWrapper {
    @config({ default: 8080 }) PORT!: number;
    @config({ default: '5mb' }) HTTP_JSON_LIMIT!: string;
    @config({ default: '1mb' }) HTTP_FORM_LIMIT!: string;
    @config({ default: 50 * 1024 * 1024 }) HTTP_MAX_FILE_SIZE_BYTES!: number;
    @config({ default: false }) HTTP_INCLUDE_UNPARSED_BODY!: boolean;
    @config({ default: 10000 }) HTTP_SHUTDOWN_DELAY!: number;
    @config({ default: 300000 }) HTTP_TIMEOUT!: number;

    constructor(
        @inject(Config) public config: Config,
        @inject('RootContainer') protected rootContainer: Container,
    ) {
    }

    protected middlewares: MiddlewareSpec[] = [
        {
            name: 'preCompressMiddleware',
            middleware: async (ctx, next) => {
                ctx.compress = false;
                await next();
            },
        },
        {
            name: 'compressMiddleware',
            middleware: compress({
                threshold: 2048,
                gzip: {
                    // eslint-disable-next-line import/no-commonjs
                    flush: require('zlib').constants.Z_SYNC_FLUSH,
                },
                deflate: {
                    // eslint-disable-next-line import/no-commonjs
                    flush: require('zlib').constants.Z_SYNC_FLUSH,
                },
            }),
        },
        {
            name: 'requestContainerMiddleware',
            middleware: async (ctx: Koa.Context, next: Koa.Next) => {
                const requestContainer = new Container({ skipBaseClassChecks: true });
                requestContainer.parent = this.rootContainer;
                requestContainer.bind('KoaContext').toConstantValue(ctx);
                requestContainer.bind(Logger).to(RequestLogger).inSingletonScope();
                ctx.container = requestContainer;
                ctx.logger = requestContainer.get<Logger>(Logger);
                return next();
            }
        },
        {
            name: 'bodyParser',
            middleware: bodyParser({
                json: true,
                urlencoded: true,
                multipart: true,
                jsonLimit: this.HTTP_JSON_LIMIT,
                formLimit: this.HTTP_FORM_LIMIT,
                formidable: {
                    maxFileSize: this.HTTP_MAX_FILE_SIZE_BYTES,
                },
                includeUnparsed: this.HTTP_INCLUDE_UNPARSED_BODY
            })
        },
        {
            name: 'bodyParser',
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
            name: 'acAuthMiddleware',
            middleware: async (ctx: Koa.Context, next: Koa.Next) => {
                const container: Container = ctx.container;
                const provider = container.get(AcAuthProvider);
                const acAuth = await provider.provide();
                container.bind(AcAuth).toConstantValue(acAuth);
                return next();
            }
        },
        {
            name: 'routingMiddleware',
            middleware: async (ctx: Koa.Context) => {
                const container: Container = ctx.container;
                const routers = container.getAll<Router>(Router);
                for (const router of routers) {
                    const handled = await router.handle();
                    if (handled) {
                        return;
                    }
                }
                throw new RouteNotFoundError();
            },
        }
    ];

    private transformMiddlewares(m: MiddlewareSpec[]): MiddlewareSpec[] {
        return m;
    }

    getAllMiddlewares() {
        return this.transformMiddlewares(this.middlewares);
    }
}
