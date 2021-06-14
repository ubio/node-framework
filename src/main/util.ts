import 'reflect-metadata';

import { ErrorObject as AjvErrorObject } from 'ajv';
import { Container, interfaces } from 'inversify';
import { v4 as uuid } from 'uuid';

export type Constructor<T> = new (...args: any[]) => T;
export type AnyConstructor = new (...args: any[]) => {};

export function deepClone<T>(data: T): T {
    return data == null ? null : JSON.parse(JSON.stringify(data));
}

export function groupBy<T, K>(items: T[], fn: (item: T, index: number) => K): Array<[K, T[]]> {
    const map: Map<K, T[]> = new Map();
    for (const [i, item] of items.entries()) {
        const key = fn(item, i);
        const list = map.get(key);
        if (list) {
            list.push(item);
        } else {
            map.set(key, [item]);
        }
    }
    return [...map.entries()];
}

export function sortBy<T, K>(items: T[], fn: (item: T) => K): T[] {
    return items.slice().sort((a, b) => fn(a) > fn(b) ? 1 : -1);
}

export function ajvErrorToMessage(e: AjvErrorObject): string {
    const msgs = [];
    if (e.keyword === 'additionalProperties') {
        const prop = e.params && (e.params as any).additionalProperty;
        msgs.push(e.schemaPath, 'additional property', prop && `'${prop}'`, 'not allowed');
    } else {
        msgs.push(e.instancePath, e.message);
    }
    return msgs.filter(Boolean).join(' ');
}

export function fakeUuid(char: string): string {
    return uuid().replace(/[0-9a-f]/g, char);
}

export interface EntityList<T> {
    entities: T[];
    totalCount: number;
}

export function addClassMetadata<T>(key: Symbol, target: any, datum: T) {
    const metadata = Reflect.getOwnMetadata(key, target) || [];
    metadata.push(datum);
    Reflect.defineMetadata(key, metadata, target);
}

export function getClassMetadata<T>(key: Symbol, target: any): T[] {
    let result: T[] = [];
    let proto = target;
    while (proto !== Object.prototype) {
        const ownMetadata: T[] = Reflect.getOwnMetadata(key, proto) || [];
        result = ownMetadata.concat(result);
        proto = Object.getPrototypeOf(proto);
    }
    return result;
}

export function getBindingsMap(container: Container):
    Map<interfaces.ServiceIdentifier<any>, interfaces.Binding<any>[]> {
    return (container as any)._bindingDictionary._map;
}
