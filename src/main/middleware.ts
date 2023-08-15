import { Context } from 'koa';
import { v4 as uuid } from 'uuid';

import { ServerError } from './exception.js';

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
        const hasStatus = typeof error.status === 'number' && error.status >= 100 && error.status < 599;
        ctx.status = hasStatus ? error.status : 500;
        const logLevel = ctx.status >= 500 ? 'error' : 'info';
        ctx.logger[logLevel](`HTTP error`, {
            method: ctx.method,
            url: ctx.url,
            status: ctx.status,
            took: Date.now() - startedAt,
            agent,
            requestId,
            error,
        });
        const presentedErr = hasStatus ? error : new ServerError();
        ctx.body = {
            object: 'error',
            name: presentedErr.name,
            message: presentedErr.message,
            details: presentedErr.details,
        };
    } finally {
        ctx.header['x-request-id'] = requestId;
        ctx.header['server-timing'] = `total;dur=${Date.now() - startedAt}`;
    }
}
