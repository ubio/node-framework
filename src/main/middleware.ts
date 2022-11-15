import { Context } from 'koa';
import { v4 as uuid } from 'uuid';

import { ClientError } from './exception.js';

export async function standardMiddleware(ctx: Context, next: () => Promise<any>) {
    const startedAt = Date.now();
    const requestId = ctx.headers['x-request-id'] || uuid();
    const agent = ctx.header['user-agent'];
    ctx.state.requestId = requestId;
    try {
        await next();
        ctx.logger.info(`HTTP request`, {
            method: ctx.method,
            url: ctx.url,
            status: ctx.status,
            took: Date.now() - startedAt,
            agent,
            requestId,
        });
    } catch (error: any) {
        const status = Number(error.status) || 500;
        const isClientError = status >= 400 && status < 500;
        const logLevel = isClientError ? 'info' : 'error';
        ctx.status = isClientError ? error.status : 500;
        ctx.logger[logLevel](`HTTP error`, {
            method: ctx.method,
            url: ctx.url,
            status: ctx.status,
            took: Date.now() - startedAt,
            agent,
            requestId,
            error,
        });
        if (error instanceof ClientError) {
            ctx.status = error.status;
            ctx.body = {
                object: 'error',
                name: error.name,
                message: error.message,
                details: error.details,
            };
        } else {
            ctx.status = 500;
            ctx.body = {
                object: 'error',
                name: 'ServerError',
                message: 'The request cannot be processed.',
            };
        }
    } finally {
        ctx.header['x-request-id'] = requestId;
        ctx.header['server-timing'] = `total;dur=${Date.now() - startedAt}`;
    }
}
