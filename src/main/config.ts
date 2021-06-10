import 'reflect-metadata';

import { Container, injectable } from 'inversify';

import { Exception } from './exception';
import { addClassMetadata, getBindingsMap, getClassMetadata } from './util';

const CONFIG_METADATA_KEY = Symbol('CONFIG_METADATA_KEY');

export type ConfigType = String | Boolean | Number;

export interface ConfigDecl {
    key: string;
    type: ConfigType;
    defaultValue?: string;
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
        addClassMetadata<ConfigDecl>(CONFIG_METADATA_KEY, prototype, { key, type, defaultValue });
        switch (type) {
            case String: {
                Object.defineProperty(prototype, key, {
                    get() {
                        return (this as Configurable).config.getString(key, defaultValue);
                    }
                });
                break;
            }
            case Number: {
                Object.defineProperty(prototype, key, {
                    get() {
                        return (this as Configurable).config.getNumber(key, defaultValue);
                    }
                });
                break;
            }
            case Boolean: {
                Object.defineProperty(prototype, key, {
                    get() {
                        return (this as Configurable).config.getBoolean(key, defaultValue);
                    }
                });
                break;
            }
        }
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

    protected getOrNull<T>(
        key: string,
        parse: (str: string) => T | null,
        defaultValue?: string | T,
    ): T | null {
        const str = this.resolve(key) ?? defaultValue;
        return str == null ? null : parse(String(str));
    }

    protected get<T>(key: string, parse: (str: string) => T | null, defaultValue?: string | T): T {
        const val = this.getOrNull(key, parse, defaultValue);
        if (val == null) {
            throw new ConfigError(`Configuration ${key} is missing`);
        }
        return val;
    }

    getString(key: string, defaultValue?: string): string {
        return this.get(key, parseString, defaultValue);
    }

    getNumber(key: string, defaultValue?: string | number): number {
        return this.get(key, parseNumber, defaultValue);
    }

    getBoolean(key: string, defaultValue?: string | boolean): boolean {
        return this.get(key, parseBoolean, defaultValue);
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

function parseString(str: string) {
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
