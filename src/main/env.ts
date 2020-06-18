import assert from 'assert';
import dotenv from 'dotenv';

dotenv.config();

export const missingKeys: string[] = [];

export function readString(key: string, defaultValue?: string): string {
    const value = process.env[key];
    if (value == null) {
        if (defaultValue != null) {
            return defaultValue;
        }
        missingKeys.push(key);
        return '';
    }
    return value;
}

export function readNumber(key: string, defaultValue?: number): number {
    const str = readString(key, defaultValue == null ? undefined : String(defaultValue));
    const num = Number(str);
    if (isNaN(num)) {
        if (defaultValue != null) {
            return defaultValue;
        }
        missingKeys.push(key);
        return 0;
    }
    return num;
}

export function assertEnv() {
    assert(!missingKeys.length, `Missing environment: ${missingKeys.join(', ')}`);
}

export function resetEnv() {
    missingKeys.splice(0, missingKeys.length);
}
