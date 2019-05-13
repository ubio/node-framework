import 'reflect-metadata';
import Ajv from 'ajv';
import { ajvErrorToMessage, AnyConstructor, createError } from './util';
import uuid from 'uuid';

const FIELDS_KEY = Symbol('Fields');

const validationSchemaCache: Map<string, EntitySchema> = new Map();
const validationFnCache: Map<string, Ajv.ValidateFunction> = new Map();

const ajv = new Ajv({
    allErrors: true,
    useDefaults: true,
    jsonPointers: true,
    format: 'full',
});

export type PrimitiveSchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array';

export interface EntitySchema {
    type: PrimitiveSchemaType |
        ['null', PrimitiveSchemaType];
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
            serialized = true,
            deprecated = false,
        } = spec;
        const primitiveType = Array.isArray(schema.type) ? schema.type[1] : schema.type;
        const nullable = Array.isArray(schema.type) && schema.type[0] === 'null';
        const entityClass: AnyConstructor | null = entity ? entity() : null;
        // Validate schema compatibility with other options, enhance it with nested types
        if (schema.type === 'array') {
            // Arrays require either explicit `items` schema, or sub entity constructor to derive schema from
            if (!entityClass && !schema.type) {
                throw new Error(`@Field ${propertyKey}: array field must specify either entity or items schema`);
            }
            if (entityClass && schema.type) {
                throw new Error(`@Field ${propertyKey}: array field must not specify both entity and items schema`);
            }
        }
        const field: FieldDefinition = {
            propertyKey,
            description,
            schema,
            presenters,
            entityClass,
            serialized,
            deprecated,
            nullable,
            primitiveType
        };
        const fields: FieldDefinition[] = Reflect.getMetadata(FIELDS_KEY, prototype) || [];
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
        throw createError({
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
            let value = (this as any)[field.propertyKey];
            if (value && value instanceof Entity) {
                value = value.present(presenter);
            }
            object[field.propertyKey] = value;
        }
        return object;
    }

    assign(object: any): this {
        // TODO cache fields if this becomes too slow
        const fields = getAllFields(this.constructor as AnyConstructor);
        for (const [k, v] of Object.entries(object)) {
            const field = fields.find(f => f.propertyKey === k);
            if (!field) {
                continue;
            }
            (this as any)[field.propertyKey] = deserializeFieldValue(field, v);
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

}

export function getAllFields(entityClass: AnyConstructor): FieldDefinition[] {
    return Reflect.getMetadata(FIELDS_KEY, entityClass.prototype) || [];
}

export function getFieldsForPresenter(entityClass: AnyConstructor, presenter: string = '') {
    const fields = getAllFields(entityClass);
    return presenter ? fields.filter(_ => _.presenters.includes(presenter)) : fields;
}

export function getValidationSchema(entityClass: AnyConstructor, presenter: string = ''): EntitySchema {
    const schemaId = entityClass.name + ':' + presenter;
    const cached = validationSchemaCache.get(schemaId);
    if (cached) {
        return cached;
    }
    const fields = getFieldsForPresenter(entityClass, presenter);
    const properties: any = {};
    const required: string[] = [];
    for (const field of fields) {
        let schema = { ...field.schema };
        // Enhance object and array schema if entity class is provided
        if (field.primitiveType === 'object' && field.entityClass) {
            const subSchema = getValidationSchema(field.entityClass, presenter);
            schema = { ...subSchema, ...schema };
        }
        if (field.primitiveType === 'array' && field.entityClass) {
            const subSchema = getValidationSchema(field.entityClass, presenter);
            schema.items = subSchema;
        }
        properties[field.propertyKey] = schema;
        required.push(field.propertyKey);
    }
    const schema: EntitySchema = {
        type: 'object',
        properties,
        required,
        additionalProperties: false,
    };
    validationSchemaCache.set(schemaId, schema);
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
    const schemaId = entityClass.name + ':' + presenter;
    const cached = validationFnCache.get(schemaId);
    if (cached) {
        return cached;
    }
    const fn = ajv.compile(getValidationSchema(entityClass, presenter));
    validationFnCache.set(schemaId, fn);
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
    // evaluated fields
    primitiveType: PrimitiveSchemaType;
    nullable: boolean;
}

export interface FieldSpec {
    description?: string;
    schema: EntitySchema;
    presenters?: string[];
    entity?: () => AnyConstructor;
    serialized?: boolean;
    deprecated?: boolean;
}

function deserializeFieldValue(
    key: string,
    value: any,
    primitiveType: PrimitiveSchemaType,
    nullable: boolean,
    entityClass: AnyConstructor | null,
    items?: EntitySchema
): any {
    if (value == null) {
        if (nullable) {
            return null;
        }
        throw createError({
            name: 'DeserializationError',
            message: `Cannot assign null to non-nullable field ${key}`,
        });
    }
    switch (primitiveType) {
        case 'array': {
            const array = Array.isArray(value) ? value : [value];
            if (entityClass) {
                return array.map(v => deserializeSubEntity(entityClass, v));
            }
            if (items) {
                return array.map(v => deserializeFieldValue(key, v, items.type, false, null));
            }
            throw createError({
                name: 'DeserializationError',
                message: `Cannot deserialize array ${key}`,
            });
        }
        case 'object': {
            if (entityClass) {
                return deserializeSubEntity(entityClass, value);
            }
            return value;
        }
        case 'string': {
            return String(value);
        }
        case 'boolean': {
            return Boolean(value);
        }
        case 'number': {
            return parseFloat(value) || 0;
        }
        case 'integer': {
            return parseInt(value, 10) || 0;
        }
    }
}

function deserializeSubEntity(constructor: AnyConstructor, value: any) {
    const subEntity = (new constructor()) as Entity;
    return subEntity.assign(value);
}
