import { Context } from 'koa';


export async function requestLog(ctx: Context, next: () => Promise<any>) {
    const startedAt = Date.now();
    const level = process.env.REQUEST_LOG ?? 'debug';
    try {
        await next();
    } finally {
        const logger = ctx.logger;
        if (['info', 'debug'].includes(level)) {
            const latency = (Date.now() - startedAt) + 'ms';
            logger[level](`HTTP`, {
                method: ctx.method,
                url: ctx.url,
                status: ctx.status,
                userAgent: ctx.headers['user-agent'],
                referrer: ctx.headers['referer'],
                latency,
                ip: ctx.ip,
            });
        }
    }
}
