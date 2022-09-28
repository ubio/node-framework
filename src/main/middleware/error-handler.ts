import { Context } from 'koa';

import { ClientError } from '../exception.js';

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
    } catch (error: any) {
        ctx.logger.warn(`Request failed: ${error.stack}`.trim(), {
            method: ctx.method,
            url: ctx.url,
            requestId: ctx.header['x-request-id'],
            details: error.details ?? {},
        });
        if (error instanceof ClientError) {
            ctx.status = error.status;
            ctx.body = {
                object: 'error',
                name: error.name,
                message: error.message,
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
