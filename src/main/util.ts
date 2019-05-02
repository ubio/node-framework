import Ajv from 'ajv';
import { getValidationSchema } from './entity';
import { Response } from 'node-fetch';

export function deepClone<T>(data: T): T {
    return data == null ? null : JSON.parse(JSON.stringify(data));
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

export type Constructor<T> = new (...args: any[]) => T;
export type AnyConstructor = new (...args: any[]) => {};

export function createError(info: ErrorInfo): Error {
    const err = new Error();
    Object.assign(err, {
        message: info.name,
        ...info
    });
    return err;
}

export interface ErrorInfo {
    name: string;
    message?: string;
    status?: number;
    details?: object;
}

export async function createErrorFromResponse(res: Response) {
    try {
        const json = await res.json();
        throw createError({
            name: json.name || 'InternalError',
            ...json,
            status: res.status,
        });
    } catch (err) {
        throw createError({
            name: 'InternalError',
            details: {
                error: {
                    name: err.name,
                    message: err.message,
                    details: err.details,
                }
            }
        });
    }
}
