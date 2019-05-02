import 'reflect-metadata';
import Ajv from 'ajv';
import { ajvErrorToMessage, AnyConstructor, createError } from './util';
import uuid from 'uuid';

const FIELDS_KEY = Symbol('Fields');

const validationSchemaCache: Map<string, object> = new Map();
const validationFnCache: Map<string, Ajv.ValidateFunction> = new Map();

const ajv = new Ajv({
    allErrors: true,
    useDefaults: true,
    jsonPointers: true,
    format: 'full',
});

export function Field(spec: FieldSpec) {
    return (prototype: any, propertyKey: string) => {
        const {
            description = '',
            schema,
            presenters = [],
            entity,
            deserializeItem,
            nullable = false,
            serialized = true,
            deprecated = false,
        } = spec;
        const designType = Reflect.getMetadata('design:type', prototype, propertyKey);
        if (designType === Array) {
            if (!entity && !deserializeItem) {
                throw new Error(`@Field ${propertyKey}: array field must specify entity or deserializeItem`);
            }
        }
        const field = {
            propertyKey,
            description,
            schema,
            presenters,
            entity,
            deserializeItem,
            designType,
            nullable,
            serialized,
            deprecated,
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
        // TODO how to go about { object: 'blah' } field?
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
        for (const field of getAllFields(this.constructor as AnyConstructor)) {
            const val = object[field.propertyKey];
            if (val === undefined) {
                continue;
            }
            (this as any)[field.propertyKey] = deserializeFieldValue(field, val);
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

export function getValidationSchema(entityClass: AnyConstructor, presenter: string = ''): object {
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
        if (field.entity) {
            const subEntityClass = field.entity();
            const subSchema = getValidationSchema(subEntityClass, presenter);
            schema = { ...subSchema, ...schema };
        }
        properties[field.propertyKey] = schema;
        required.push(field.propertyKey);
    }
    const schema = {
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
    schema: any;
    presenters: string[];
    designType: (...args: any) => any;
    entity?: () => AnyConstructor;
    deserializeItem?: (value: any) => any;
    nullable: boolean;
    serialized: boolean;
    deprecated: boolean;
}

export interface FieldSpec {
    description?: string;
    schema: any;
    presenters?: string[];
    entity?: () => AnyConstructor;
    deserializeItem?: (value: any) => any;
    nullable?: boolean;
    serialized?: boolean;
    deprecated?: boolean;
}

function deserializeFieldValue(field: FieldDefinition, value: any): any {
    if (value == null) {
        if (field.nullable) {
            return null;
        }
        throw createError({
            name: 'DeserializationError',
            message: `Cannot assign null to non-nullable field ${field.propertyKey}`,
        });
    }
    if (field.designType === Array) {
        const array = Array.isArray(value) ? value : [value];
        return array.map(v => {
            if (field.deserializeItem) {
                return field.deserializeItem(v);
            }
            if (field.entity) {
                return deserializeSubEntity(field.entity(), v);
            }
            throw createError({
                name: 'DeserializationError',
                message: `Cannot deserialize array field ${field.propertyKey}`,
            });
        });
    } else if (field.entity) {
        return deserializeSubEntity(field.entity(), value);
    } else {
        return field.designType(value);
    }
}

function deserializeSubEntity(constructor: AnyConstructor, value: any) {
    const subEntity = (new constructor()) as Entity;
    return subEntity.assign(value);
}
