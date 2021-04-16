export type BaseSchema = {
    enum?: any[];
    const?: any;
    nullable?: true;
    optional?: true;
    default?: any;
}

export type BooleanSchema = {
    type: 'boolean';
}

export type StringSchema = {
    type: 'string';
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    format?: string;
}

export type NumberSchema = {
    type: 'number' | 'integer';
    minimum?: number;
    maximum?: number;
    exclusiveMinimum?: number;
    exclusiveMaximum?: number;
    multipleOf?: number;
}

export type ObjectSchema<T> = {
    type: 'object';
    properties: PropertiesSpec<T>;
    required?: Array<keyof T>;
    patternProperties?: { [key: string]: JsonSchema<any> };
    additionalProperties?: boolean | JsonSchema<any>;
    propertyNames?: JsonSchema<any>;
}

export type ArraySchema<T> = {
    type: 'array';
    items: JsonSchema<T>;
    minItems?: number;
    maxItems?: number;
    uniqueItems?: number;
    additionalItems?: boolean | JsonSchema<T>;
    contains?: JsonSchema<T>;
}

export type JsonSchema<T> = (
    T extends string ? StringSchema :
    T extends number ? NumberSchema :
    T extends boolean ? BooleanSchema :
    T extends Array<infer P> ? ArraySchema<P> :
    T extends object ? ObjectSchema<T> :
    never
) & BaseSchema;

export type OptionalSchema<T> = JsonSchema<T> & { optional: true };
export type RequiredSchema<T> = Omit<JsonSchema<T>, 'optional'>;
export type NullableSchema<T> = JsonSchema<T> & { nullable: true };
export type NonNullableSchema<T> = Omit<JsonSchema<T>, 'nullable'>;

export type OptionalNullableSchema<T> = JsonSchema<T> & { optional: true, nullable: true }
export type OptionalNonNullableSchema<T> = Omit<JsonSchema<T> & { optional: true }, 'nullable'>
export type RequiredNullableSchema<T> = Omit<JsonSchema<T> & { nullable: true }, 'optional'>
export type RequiredNonNullableSchema<T> = Omit<JsonSchema<T>, 'optional' | 'nullable'>

export type PropertiesSpec<T> = {
    [K in keyof T]-?: InferOptionalNullable<T, K>;
}

type InferOptionalNullable<T, K extends keyof T> =
    undefined extends T[K] ? (
        null extends T[K] ? OptionalNullableSchema<T[K]> : OptionalNonNullableSchema<T[K]>
    ) : (
        null extends T[K] ? RequiredNullableSchema<T[K]> : RequiredNonNullableSchema<T[K]>
    );

export type JsonSchemaTypePrimitive = 'null' | 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
export type JsonSchemaType = JsonSchemaTypePrimitive | JsonSchemaTypePrimitive[];
