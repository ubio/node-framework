import { Context } from 'koa';

/**
 * Installs X-Response-Time response header.
 */
export async function responseTime(ctx: Context, next: () => Promise<any>) {
    const startedAt = Date.now();
    ctx.state.startedAt = startedAt;
    try {
        await next();
    } catch (error) {
        ctx.response.set('x-response-time', `${Date.now() - startedAt}ms`);
    }
}
