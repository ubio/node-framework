import 'reflect-metadata';

import { ErrorObject as AjvErrorObject } from 'ajv';
import { promises as fs } from 'fs';
import { Mesh, ServiceConstructor } from 'mesh-ioc';
import path from 'path';
import { v4 as uuid } from 'uuid';

import { Exception } from './exception.js';

export type Constructor<T> = new (...args: any[]) => T;
export type AnyConstructor = new (...args: any[]) => {};

export function deepClone<T>(data: T): T | null {
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

export async function getAppDetails() {
    const { name, version } = await getPackageJson();
    return {
        name: name.replace(/^@.*\//, ''),
        version
    };
}

async function getPackageJson() {
    const pkgPath = path.join(process.cwd(), 'package.json');
    try {
        const packageJsonFile = path.join(pkgPath);
        const pkg = await fs.readFile(packageJsonFile, 'utf-8');
        return JSON.parse(pkg);

    } catch (error: any) {
        const reason = error instanceof SyntaxError ? 'package.json is malformed' :
            error.code === 'ENOENT' ? 'package.json not found' : error.message;
        throw new Exception(`Cannot get App Details: ${reason}`);
    }
}

export function findMeshInstances<T>(mesh: Mesh, ctor: ServiceConstructor<T>): T[] {
    const instances: T[] = [];
    for (const [key] of mesh) {
        const instance = mesh.tryResolve(key);
        if (instance instanceof ctor) {
            instances.push(instance);
        }
    }
    if (mesh.parent) {
        instances.push(...findMeshInstances(mesh.parent, ctor));
    }
    return instances;
}

export function getSingleValue<T>(value: T | T[] | undefined): T | undefined {
    if (Array.isArray(value)) {
        return value[0];
    }
    return value;
}
