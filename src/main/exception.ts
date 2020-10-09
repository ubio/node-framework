/**
 * Standard error middleware presents instances of Exception class
 * as { object: 'error', name, message, details }.
 * All other errors are presented as a generic 'ServerError'.
 *
 * Use this class to create more specific error classes.
 * Class name should be interpreted as error code.
 */
export class Exception extends Error {
    name = this.constructor.name;
    status: number = 500;
    details: any = {};
}
