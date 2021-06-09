import 'reflect-metadata';

import { injectable } from 'inversify';

import { Exception } from './exception';

// const GLOBAL_MAP_KEY = Symbol('configMap');
//
// export function getConfigDeclarations(): ConfigDecl[] {
//     let list: ConfigDecl[] = (global as any)[GLOBAL_MAP_KEY];
//     if (!Array.isArray(list)) {
//         list = [];
//         (global as any)[GLOBAL_MAP_KEY] = list;
//     }
//     return list;
// }

export type ConfigType = String | Boolean | Number;

export type Configurable = { config: Config; }

export interface ConfigDecl {
    prototype: Configurable;
    key: string;
    type: ConfigType;
    defaultValue?: string;
}

export interface ConfigOptions {
    default?: ConfigType;
}

export function config(options: ConfigOptions = {}) {
    return (prototype: Configurable, key: string) => {
        const type = Reflect.getMetadata('design:type', prototype, key);
        if (![String, Boolean, Number].includes(type)) {
            throw new ConfigError('@config can only be used with string, number or boolean types');
        }
        const defaultValue = options.default == null ? undefined : String(options.default);
        // getConfigDeclarations().push({
        //     prototype,
        //     key,
        //     type,
        //     defaultValue,
        // });
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

@injectable()
export abstract class Config {
    abstract resolve(key: string): string | null;

    protected getOrNull<T>(
        key: string,
        parse: (str: string) => T | null,
        defaultValue?: string | T,
    ): T | null {
        let str = this.resolve(key);
        if (str == null) {
            str = String(defaultValue);
        }
        return str == null ? null : parse(str);
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
export class EnvConfig extends Config {
    resolve(key: string): string | null {
        return process.env[key] ?? null;
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
