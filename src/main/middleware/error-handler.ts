import { Context } from 'koa';
import { ClientError } from '../exception';

/**
 * Handles error thrown during request processing.
 * The error is presented as JSON as in example below:
 *
 * ```
 * {
 *     "object": "error",
 *     "name": "RouteNotFoundError",
 *     "message": "Route not found"
 * }
 * ```
 */
export async function errorHandler(ctx: Context, next: () => Promise<any>) {
    try {
        await next();
    } catch (error) {
        ctx.logger.warn(`Error: ${error.name} ${error.message}`.trim(), {
            method: ctx.method,
            url: ctx.url,
            requestId: ctx.header['x-request-id'],
            ...error,
        });
        ctx.logger.debug(error.stack);
        if (error instanceof ClientError) {
            ctx.status = error.status;
            ctx.body = {
                object: 'error',
                name: error.name,
                message: error.message || '',
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
    }
}
