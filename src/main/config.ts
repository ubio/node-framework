import 'reflect-metadata';

import { Container, injectable } from 'inversify';

import { Exception } from './exception';
import { addClassMetadata, getBindingsMap, getClassMetadata } from './util';

const CONFIG_METADATA_KEY = Symbol('CONFIG_METADATA_KEY');

export type ConfigType = string | boolean | number;
export type ConfigParser<T> = (str: string) => T | null;
export type ConfigTypeCtor<T extends ConfigType> =
    T extends string ? typeof String :
    T extends number ? typeof Number :
    T extends boolean ? typeof Boolean : never;

export interface ConfigDecl {
    key: string;
    type: ConfigTypeCtor<any>;
    defaultValue?: string;
    prototype: Configurable;
}

export interface ConfigOptions {
    default?: ConfigType;
}

export type Configurable = { config: Config; }

export function config(options: ConfigOptions = {}) {
    return (prototype: Configurable, key: string) => {
        const type = Reflect.getMetadata('design:type', prototype, key);
        if (![String, Boolean, Number].includes(type)) {
            throw new ConfigError('@config can only be used with string, number or boolean types');
        }
        const defaultValue = options.default == null ? undefined : String(options.default);
        addClassMetadata<ConfigDecl>(CONFIG_METADATA_KEY, prototype, { key, type, defaultValue, prototype });
        Object.defineProperty(prototype, key, {
            get() {
                return (this as Configurable).config.get(key, type, defaultValue);
            }
        });
    };
}

/**
 * Returns all `@config()` declared in class and its ancestors.
 */
export function getClassConfigs(classOrProto: any): ConfigDecl[] {
    const target = classOrProto instanceof Function ? classOrProto.prototype : classOrProto;
    return getClassMetadata(CONFIG_METADATA_KEY, target);
}

/**
 * Returns all `@config()` declarations for all classes bound to the container.
 */
export function getContainerConfigs(container: Container): ConfigDecl[] {
    const result: ConfigDecl[] = [];
    for (const bindings of getBindingsMap(container).values()) {
        for (const binding of bindings) {
            if (typeof binding.implementationType === 'function') {
                const configs = getClassConfigs(binding.implementationType);
                result.push(...configs);
            }
        }
    }
    return result.sort((a, b) => a.key > b.key ? 1 : -1);
}

@injectable()
export abstract class Config {

    abstract resolve(key: string): string | null;

    static parsers: { [key: string]: ConfigParser<ConfigType> } = {
        String: parseString,
        Number: parseNumber,
        Boolean: parseBoolean,
    };

    getOrNull<T extends ConfigType>(key: string, type: ConfigTypeCtor<T>, defaultValue?: string | T): T | null {
        const str = this.resolve(key) ?? defaultValue;
        const parser = Config.parsers[type.name] as ConfigParser<T>;
        return str == null ? null : parser(String(str));
    }

    get<T extends ConfigType>(key: string, type: ConfigTypeCtor<T>, defaultValue?: string | T): T {
        const val = this.getOrNull(key, type, defaultValue);
        if (val == null) {
            throw new ConfigError(`Configuration ${key} is missing`);
        }
        return val;
    }

    hasKey(key: string) {
        return this.resolve(key) != null;
    }

    getString(key: string, defaultValue?: string): string {
        return this.get<string>(key, String, defaultValue);
    }

    getNumber(key: string, defaultValue?: string | number): number {
        return this.get<number>(key, Number, defaultValue);
    }

    getBoolean(key: string, defaultValue?: string | boolean): boolean {
        return this.get<boolean>(key, Boolean, defaultValue);
    }

}

@injectable()
export class DefaultConfig extends Config {
    map: Map<string, string> = new Map();

    constructor() {
        super();
        for (const [k, v] of Object.entries(process.env)) {
            if (v != null) {
                this.map.set(k, v);
            }
        }
    }

    resolve(key: string): string | null {
        return this.map.get(key) ?? null;
    }
}

function parseString(str: string): string | null {
    return str;
}

function parseNumber(str: string): number | null {
    const num = Number(str);
    return isNaN(num) ? null : num;
}

function parseBoolean(str: string): boolean | null {
    return str === 'true';
}

export class ConfigError extends Exception {}
