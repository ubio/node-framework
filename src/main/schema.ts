import Ajv, { ErrorObject, Options, ValidateFunction } from 'ajv';

import { ClientError } from './exception';
import { JsonSchema } from './schema-types';
import { ajvErrorToMessage } from './util';

/**
 * An utility class that allows validating and decoding objects using JSON Schema.
 */
export class Schema<T> {
    schema: JsonSchema<T>;

    protected ajv: Ajv;
    protected validateFn: ValidateFunction;
    protected defaults: SchemaDefaults<T>;
    protected options: SchemaPreprocessingOptions;

    constructor(init: SchemaInit<T>) {
        const {
            schema,
            defaults = {},
            ajvOptions = {},
            options = {},
        } = init;
        this.options = {
            requiredByDefault: true,
            noAdditionalProperties: true,
            ...options,
        };
        this.ajv = new Ajv({
            strict: true,
            allErrors: true,
            messages: true,
            useDefaults: true,
            removeAdditional: this.options.noAdditionalProperties ? 'all' : false,
            keywords: ['optional'],
            ...ajvOptions,
        });
        this.schema = this.preprocess(schema);
        this.defaults = defaults;
        this.validateFn = this.ajv.compile(this.schema);
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

    protected preprocess(schema: JsonSchema<T>) {
        return JSON.parse(JSON.stringify(schema), (k, v) => {
            if (v && typeof v === 'object' && v.type === 'object') {
                if (this.options.requiredByDefault) {
                    const required: string[] = [];
                    const properties = v.properties || {};
                    for (const [key, value] of Object.entries<JsonSchema<any>>(properties)) {
                        const optional = value.optional || false;
                        if (!optional) {
                            required.push(key);
                        }
                    }
                    v.required = required;
                }
                if (this.options.noAdditionalProperties) {
                    v.additionalProperties = false;
                }
            }
            return v;
        });
    }
}

export class ValidationError extends ClientError {
    status = 400;
    constructor(messages: string[]) {
        super(`Validation failed:\n${messages.map(_ => `    - ${_}`).join('\n')}`);
        this.details = {
            messages
        };
    }
}

export interface SchemaInit<T> {
    schema: JsonSchema<T>;
    defaults?: SchemaDefaults<T>;
    ajvOptions?: Options;
    options?: Partial<SchemaPreprocessingOptions>;
}

export interface SchemaPreprocessingOptions {
    // Enables `optional` keyword, pre-computes `required` in object schema
    requiredByDefault: boolean;
    // Adds `removeAdditional: 'all'` and `additionalProperties: false`
    noAdditionalProperties: boolean;
}

export type SchemaDefaults<T> = (() => Partial<T>) | Partial<T>;
