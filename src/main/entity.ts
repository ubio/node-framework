import 'reflect-metadata';
import Ajv from 'ajv';
import { ajvErrorToMessage, AnyConstructor, Constructor } from './util';
import uuid from 'uuid';
import { Exception } from './exception';

const FIELDS_KEY = Symbol('Entity:fields');
const SCHEMA_KEY = Symbol('Entity:schema');
const VALIDATOR_KEY = Symbol('Entity:validator');

const ajv = new Ajv({
    allErrors: true,
    useDefaults: true,
    jsonPointers: true,
    format: 'full',
});

export type SchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array';

export interface EntitySchema {
    type?: SchemaType;
    items?: EntitySchema;
    [keywords: string]: any;
}

export function Field(spec: FieldSpec) {
    return (prototype: any, propertyKey: string) => {
        const {
            description = '',
            schema,
            presenters = [],
            entity,
            required = true,
            serialized = true,
            deprecated = false,
        } = spec;
        const entityClass: AnyConstructor | null = entity || null;
        // Validate schema compatibility with other options, enhance it with nested types
        if (schema.type === 'array') {
            // Arrays require either explicit `items` schema, or sub entity constructor to derive schema from
            if (!entityClass && !schema.items) {
                throw new Error(`@Field ${propertyKey}: array field must specify either entity or items schema`);
            }
            if (entityClass && schema.items) {
                throw new Error(`@Field ${propertyKey}: array field must not specify both entity and items schema`);
            }
        }
        // Deprecated `nullable`: if provided it's preferred over `required`.
        const _required = spec.nullable == null ? required : !spec.nullable;
        const field: FieldDefinition = {
            propertyKey,
            description,
            schema,
            required: _required,
            presenters,
            entityClass,
            serialized,
            deprecated
        };
        const fields: FieldDefinition[] = Reflect.getOwnMetadata(FIELDS_KEY, prototype) || [];
        fields.push(field);
        Reflect.defineMetadata(FIELDS_KEY, fields, prototype);
    };
}

/**
 * A base class for entities.
 *
 * Entities are classes which has properties annotated with Fields decorators.
 * These annotations serve several purposes:
 *
 * - define per-field schema
 * - automate presenting entities into different data formats
 * - automate entity validation
 */
export class Entity {

    // https://github.com/microsoft/TypeScript/issues/5863#issuecomment-410887254
    static fromJSON<T extends typeof Entity>(this: T, fields: object = {}): InstanceType<T> {
        const entity = (new this()) as InstanceType<T>;
        return entity.assign(fields);
    }

    static getSchema(presenter: string = ''): any {
        return getValidationSchema(this, presenter);
    }

    getValidationSchema(presenter: string = ''): any {
        return getValidationSchema(this.constructor as AnyConstructor, presenter);
    }

    getValidationErrors(presenter: string = ''): Ajv.ErrorObject[] {
        const validateFn = getValidateFunction(this.constructor as AnyConstructor, presenter);
        const valid = validateFn(this);
        if (valid) {
            return [];
        }
        return validateFn.errors || [];
    }

    validate() {
        const errors = this.getValidationErrors();
        if (errors.length === 0) {
            return;
        }
        const messages = errors.map(e => ajvErrorToMessage(e));
        throw new Exception({
            name: 'EntityValidationError',
            message: `${this.constructor.name} validation failed`,
            details: {
                messages,
            }
        });
    }

    present(presenter: string = ''): object {
        const object: { [key: string]: any } = {};
        const fields = getFieldsForPresenter(this.constructor as AnyConstructor, presenter);
        for (const field of fields) {
            const value = (this as any)[field.propertyKey];
            object[field.propertyKey] = presentFieldValue(
                presenter,
                field.propertyKey,
                value,
                field.schema.type,
                field.entityClass,
                field.schema.items
            );
        }
        return object;
    }

    assign(object: any): this {
        if (object == null || (typeof object !== 'object')) {
            return this;
        }
        // TODO cache fields if this becomes too slow
        const fields = getAllFields(this.constructor as AnyConstructor);
        for (const [k, v] of Object.entries(object)) {
            const field = fields.find(f => f.propertyKey === k);
            if (!field) {
                continue;
            }
            if (v == null && !field.required) {
                (this as any)[field.propertyKey] = null;
            } else {
                const value = deserializeFieldValue(k, v, field.schema.type, field.entityClass, field.schema.items);
                (this as any)[field.propertyKey] = value;
            }
        }
        return this;
    }

    toJSON() {
        const result: any = {};
        const fields = getAllFields(this.constructor as AnyConstructor);
        const serializedFields = fields.filter(_ => _.serialized);
        for (const field of serializedFields) {
            const val = (this as any)[field.propertyKey];
            result[field.propertyKey] = val instanceof Entity ? val.toJSON() : val;
        }
        return result;
    }

    clone(): this {
        const json = this.toJSON();
        const constructor = this.constructor as (typeof Entity);
        return constructor.fromJSON(json) as this;
    }

}

export function getAllFields(entityClass: AnyConstructor): FieldDefinition[] {
    let fields: FieldDefinition[] = [];
    let proto = entityClass.prototype;
    while (proto !== Object.prototype) {
        const ownFields: FieldDefinition[] = Reflect.getOwnMetadata(FIELDS_KEY, proto) || [];
        // eslint-disable-next-line no-loop-func
        const filteredParams = ownFields.filter(param =>
            !fields.some(p => p.propertyKey === param.propertyKey));
        fields = filteredParams.concat(fields);
        proto = Object.getPrototypeOf(proto);
    }
    return fields;
}

export function getFieldsForPresenter(entityClass: AnyConstructor, presenter: string = '') {
    const fields = getAllFields(entityClass);
    return presenter ? fields.filter(_ => _.presenters.includes(presenter)) : fields;
}

export function getValidationSchema(entityClass: AnyConstructor, presenter: string = ''): object {
    const cache: Map<string, object> = Reflect.getOwnMetadata(SCHEMA_KEY, entityClass.prototype) || new Map();
    const cached = cache.get(presenter);
    if (cached) {
        return cached;
    }
    const fields = getFieldsForPresenter(entityClass, presenter);
    const properties: any = {};
    const required: string[] = [];
    for (const field of fields) {
        let schema: any = { ...field.schema };
        // Wrap nullable types to a ['null', type] tuple
        if (!field.required) {
            const isSchemaNullable = Array.isArray(field.schema.type) && field.schema.type.includes('null');
            if (!isSchemaNullable) {
                schema.type = ['null', field.schema.type];
            }
        }
        // Enhance object and array schema if entity class is provided
        if (field.schema.type === 'object' && field.entityClass) {
            const subSchema = getValidationSchema(field.entityClass, presenter);
            schema = { ...subSchema, ...schema };
        }
        if (field.schema.type === 'array' && field.entityClass) {
            const subSchema = getValidationSchema(field.entityClass, presenter);
            schema.items = subSchema;
        }
        properties[field.propertyKey] = schema;
        required.push(field.propertyKey);
    }
    const schema = {
        type: 'object',
        properties,
        required,
        additionalProperties: true,
    };
    cache.set(presenter, schema);
    Reflect.defineMetadata(SCHEMA_KEY, cache, entityClass.prototype);
    return schema;
}

export class BaseEntity extends Entity {

    @Field({
        schema: { type: 'string', format: 'uuid' },
        presenters: ['public']
    })
    id: string = uuid.v4();

    @Field({
        schema: { type: 'number' },
        presenters: ['public']
    })
    createdAt: number = Date.now();

    @Field({
        schema: { type: 'number' },
        presenters: ['public']
    })
    updatedAt: number = Date.now();

}

export interface EntityList<T> {
    entities: T[];
    totalCount: number;
}

export function createListSchema(entityClass: AnyConstructor, presenter: string = '') {
    return {
        type: 'object',
        properties: {
            object: { type: 'string', const: 'list' },
            count: { type: 'integer' },
            data: getValidationSchema(entityClass, presenter)
        }
    };
}

export function getValidateFunction(entityClass: AnyConstructor, presenter: string = ''): Ajv.ValidateFunction {
    const cache: Map<string, any> = Reflect.getOwnMetadata(VALIDATOR_KEY, entityClass.prototype) || new Map();
    const cached = cache.get(presenter);
    if (cached) {
        return cached;
    }
    const fn = ajv.compile(getValidationSchema(entityClass, presenter));
    cache.set(presenter, fn);
    Reflect.defineMetadata(VALIDATOR_KEY, cache, entityClass.prototype);
    return fn;
}

export interface FieldDefinition {
    propertyKey: string;
    description: string;
    schema: EntitySchema;
    presenters: string[];
    entityClass: AnyConstructor | null;
    serialized: boolean;
    deprecated: boolean;
    required: boolean;
}

export interface FieldSpec {
    description?: string;
    schema: EntitySchema;
    required?: boolean;
    nullable?: boolean; // deprecated
    serialized?: boolean;
    deprecated?: boolean;
    entity?: Constructor<Entity>;
    presenters?: string[];
}

function presentFieldValue(
    presenter: string,
    key: string,
    value: any,
    type?: SchemaType,
    // only for objects and arrays
    entityClass: AnyConstructor | null = null,
    items?: EntitySchema
): any {
    switch (type) {
        case 'array': {
            if (Array.isArray(value)) {
                if (entityClass) {
                    return value.map(v => v.present(presenter));
                }
                if (items) {
                    return value.map(v => presentFieldValue(presenter, key, v, items.type));
                }
            }
            throw new Exception({
                name: 'SerializationError',
                message: `Cannot serialize array ${key}`,
            });
        }
        case 'object': {
            if (value && entityClass) {
                return value.present(presenter);
            }
            return value;
        }
        default: {
            return value;
        }
    }
}

function deserializeFieldValue(
    key: string,
    value: any,
    type?: SchemaType,
    // only for objects and arrays
    entityClass: AnyConstructor | null = null,
    items?: EntitySchema
): any {
    switch (type) {
        case 'array': {
            const array: any[] = (Array.isArray(value) ? value : [value])
                .filter(_ => _ != null);
            if (entityClass) {
                return array.map(v => deserializeSubEntity(entityClass, v));
            }
            if (items) {
                return array.map(v => deserializeFieldValue(key, v, items.type));
            }
            throw new Exception({
                name: 'DeserializationError',
                message: `Cannot deserialize array ${key}`,
            });
        }
        case 'object': {
            if (entityClass) {
                return deserializeSubEntity(entityClass, value);
            }
            return value == null ? {} : typeof value === 'object' ? value : {};
        }
        case 'string': {
            return value == null ? '' : String(value);
        }
        case 'boolean': {
            return String(value) === 'true';
        }
        case 'number': {
            return parseFloat(value) || 0;
        }
        case 'integer': {
            return parseInt(value, 10) || 0;
        }
        default: {
            return value;
        }
    }
}

function deserializeSubEntity(constructor: AnyConstructor, value: any) {
    const subEntity = (new constructor()) as Entity;
    return subEntity.assign(value);
}
