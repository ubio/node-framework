import { Context } from 'koa';

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
        ctx.status = typeof error.status === 'number' ? error.status : 500;
        ctx.body = {
            object: 'error',
            name: error.constructor.name,
            message: error.message,
            ...error
        };
        ctx.logger.warn(error.message, { error });
    }
}
