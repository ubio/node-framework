import { Context } from 'koa';

import { Logger } from '../logger';

export async function debugRequestLog(ctx: Context, next: () => Promise<any>) {
    const startedAt = Date.now();
    const enabled = process.env.DEBUG_REQUEST_LOG === 'true';
    try {
        await next();
    } finally {
        const logger = ctx.logger;
        if (enabled && logger instanceof Logger) {
            const latency = ((Date.now() - startedAt) / 1000).toFixed(2);
            // https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry#HttpRequest
            logger.debug(`${ctx.status} ${ctx.method} ${ctx.path}`, {
                httpRequest: {
                    requestMethod: ctx.method,
                    requestUrl: ctx.path,
                    status: ctx.status,
                    referrer: ctx.headers['referer'],
                    userAgent: ctx.headers['user-agent'],
                    remoteIp: ctx.ip,
                    latency,
                }
            });
        }
    }
}
