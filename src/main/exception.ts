/**
 * Utility class for creating error subclasses with more specific name and details.
 *
 * Use this class when you need to include more debugging details in logs,
 * but still prefer to not expose them via HTTP response.
 *
 * If you need to communicate additional details to clients, use `ClientError` instead.
 */
export class Exception extends Error {
    override name = this.constructor.name;
    status = 500;
    details: any = {};
}

/**
 * Standard error middleware presents instances of ClientError class
 * as { object: 'error', name, message, details }, with appropriate http status.
 * All other errors are presented as a generic 'ServerError'.
 *
 * Use this class to create more specific error classes.
 * Class name should be interpreted as error code.
 */
export class ClientError extends Exception {
    override status = 400;
}

export class ServerError extends Exception {
    override status = 500;
    override message = 'The request cannot be processed';
}
