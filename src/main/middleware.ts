import { StructuredLogHttpRequest } from '@nodescript/logger';
import { Context } from 'koa';
import { v4 as uuid } from 'uuid';

import { ServerError } from './exception.js';

export async function standardMiddleware(ctx: Context, next: () => Promise<any>) {
    let error: any = undefined;
    const startedAt = Date.now();
    const requestId = ctx.headers['x-request-id'] || uuid();
    ctx.state.requestId = requestId;
    try {
        await next();
    } catch (err: any) {
        error = err;
        const hasStatus = typeof error.status === 'number' && error.status >= 100 && error.status < 599;
        ctx.status = hasStatus ? error.status : 500;
        const presentedErr = hasStatus ? error : new ServerError();
        ctx.body = {
            object: 'error',
            name: presentedErr.name,
            message: presentedErr.message,
            details: presentedErr.details,
        };
    } finally {
        const latency = Date.now() - startedAt;
        const logLevel = ctx.status >= 500 ? 'error' : 'info';
        ctx.header['x-request-id'] = requestId;
        ctx.header['server-timing'] = `total;dur=${latency}`;
        const httpRequest: StructuredLogHttpRequest = {
            requestMethod: ctx.method,
            requestUrl: ctx.path,
            status: ctx.status,
            latency: `${latency / 1000}s`,
            userAgent: ctx.header['user-agent'],
        };
        ctx.logger[logLevel](error ? `Http Error` : `Http Request`, {
            httpRequest,
            actor: ctx.state.actor,
            requestId: ctx.requestHeaders['x-request-id'],
            error,
        });
    }
}
