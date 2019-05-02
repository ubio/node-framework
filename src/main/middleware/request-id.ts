import uuid from 'uuid';
import { Context } from 'koa';

/**
 * Forwards x-request-id header from request to response,
 * or generates a new one (uuid) if no such header present in request.
 */
export async function requestId(ctx: Context, next: () => Promise<any>) {
    const requestId = ctx.headers['x-request-id'] || uuid.v4();
    ctx.state.requestId = requestId;
    try {
        await next();
    } catch (error) {
        ctx.response.headers['x-request-id'] = requestId;
    }
}
