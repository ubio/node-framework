import Ajv, { ErrorObject, Options, ValidateFunction } from 'ajv';

import { ClientError } from './exception';
import { ajvErrorToMessage } from './util';

/**
 * An utility class that allows validating and decoding objects using JSON Schema.
 */
export class Schema<T> {
    schema: JsonSchema;

    protected ajv: Ajv;
    protected validateFn: ValidateFunction;
    protected defaults: SchemaDefaults<T>;

    constructor(options: SchemaInit<T>) {
        const {
            schema,
            defaults = {},
            ajvOptions = {},
        } = options;
        this.ajv = new Ajv({
            allErrors: true,
            messages: true,
            useDefaults: true,
            removeAdditional: 'all',
            ...ajvOptions,
        });
        this.schema = schema;
        this.defaults = defaults;
        this.validateFn = this.ajv.compile(schema);
    }

    validate(obj: any): ErrorObject[] {
        const valid = this.validateFn(obj);
        return valid ? [] : this.validateFn.errors!;
    }

    construct(obj: any): unknown {
        // Defaults are only applied to objects
        if (obj && typeof obj === 'object') {
            const defaults = typeof this.defaults === 'function' ? this.defaults() : this.defaults;
            return { ...defaults, ...obj };
        }
        return obj;
    }

    decode(obj: any): T {
        const _obj = this.construct(obj);
        const valid = this.validateFn(_obj);
        if (!valid) {
            throw new ValidationError(this.validateFn.errors!.map(_ => ajvErrorToMessage(_)));
        }
        return _obj as T;
    }
}

export class ValidationError extends ClientError {
    status = 400;
    constructor(messages: string[]) {
        super();
        this.message = `Validation failed`;
        this.details = {
            messages
        };
    }
}

export interface SchemaInit<T> {
    schema: JsonSchema;
    defaults?: SchemaDefaults<T>;
    ajvOptions?: Options;
}

export type SchemaDefaults<T> = (() => Partial<T>) | Partial<T>;

export type JsonSchemaTypePrimitive = 'null' | 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
export type JsonSchemaType = JsonSchemaTypePrimitive | JsonSchemaTypePrimitive[];

/**
 * An utility type for JSON Schema composition.
 * Since every field is optional (as per JSON Schema composition),
 * this type doesn't try to do too much to stop you from composing an incorrect schema;
 * instead it just allows your IDE to provide you with handy autocompletion hints.
 */
export interface JsonSchema {
    type?: JsonSchemaType;
    // number
    minimum?: number;
    maximum?: number;
    exclusiveMinimum?: number;
    exclusiveMaximum?: number;
    multipleOf?: number;
    // string
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    format?: string;
    // array
    minItems?: number;
    maxItems?: number;
    uniqueItems?: number;
    items?: JsonSchema | JsonSchema[];
    additionalItems?: boolean | JsonSchema;
    contains?: JsonSchema;
    // object
    minProperties?: number;
    maxProperties?: number;
    required?: string[];
    properties?: { [key: string]: JsonSchema };
    patternProperties?: { [key: string]: JsonSchema };
    additionalProperties?: boolean | JsonSchema;
    propertyNames?: JsonSchema;
    // any
    enum?: any[];
    const?: any;
    // compound
    not?: JsonSchema;
    oneOf?: JsonSchema[];
    anyOf?: JsonSchema[];
    allOf?: JsonSchema[];
    if?: JsonSchema[];
    then?: JsonSchema[];
    else?: JsonSchema[];
    // misc
    [key: string]: any;
}
