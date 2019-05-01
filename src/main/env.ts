import assert from 'assert';

export const missingEnvs: string[] = [];

export function readString(key: string, defaultValue?: string): string {
    const value = process.env[key];
    if (value == null) {
        if (defaultValue != null) {
            return defaultValue;
        }
        missingEnvs.push(key);
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
        missingEnvs.push(key);
        return 0;
    }
    return num;
}

export function assertEnv() {
    assert(!missingEnvs.length, `Missing environment: ${missingEnvs.join(', ')}`);
}

export function resetEnv() {
    missingEnvs.splice(0, missingEnvs.length);
}
