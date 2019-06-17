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
        const name = error.name === 'Error' ? error.constructor.name : error.name;
        ctx.status = typeof error.status === 'number' ? error.status : 500;
        ctx.body = {
            object: 'error',
            name,
            message: error.message || error.name
        };
        ctx.logger.warn(`Error: ${error.message}`, { error });
    }
}
