import { Context } from 'koa';


export async function requestLog(ctx: Context, next: () => Promise<any>) {
    const startedAt = Date.now();
    const level = process.env.REQUEST_LOG ?? 'debug';
    try {
        await next();
    } finally {
        const logger = ctx.logger;
        if (['info', 'debug'].includes(level)) {
            const latency = ((Date.now() - startedAt) / 1000).toFixed(2);
            // https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry#HttpRequest
            logger[level](`${ctx.status} ${ctx.method} ${ctx.path}`, {
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
