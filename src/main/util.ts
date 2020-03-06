import Ajv from 'ajv';
import uuid from 'uuid';

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

export function ajvErrorToMessage(e: Ajv.ErrorObject): string {
    const msgs = [];
    if (e.keyword === 'additionalProperties') {
        const prop = e.params && (e.params as any).additionalProperty;
        msgs.push(e.schemaPath, 'additional property', prop && `'${prop}'`, 'not allowed');
    } else {
        msgs.push(e.dataPath, e.message);
    }
    return msgs.filter(Boolean).join(' ');
}

export function fakeUuid(char: string): string {
    return uuid.v4().replace(/[0-9a-f]/g, char);
}
