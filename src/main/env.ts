import assert from 'assert';
import dotenv from 'dotenv';
import { injectable } from 'inversify';

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

@injectable()
export class FrameworkEnv {
    PORT = readNumber('PORT', 8080);
    HTTP_TIMEOUT = readNumber('HTTP_TIMEOUT', 300000);
    HTTP_SHUTDOWN_DELAY = readNumber('HTTP_SHUTDOWN_DELAY', 10000);
    API_JOB_TIMELINE_URL = readString('API_JOB_TIMELINE_URL', 'http://api-job-timeline');
    API_JOB_TIMELINE_KEY = readString('API_JOB_TIMELINE_KEY');
    AC_JWKS_URL = readString('AC_JWKS_URL', /* to be provided */);
    AC_SIGNING_KEY_ALGORITHM = readString('SIGNING_KEY_ALGORITHM', 'HS256');
    // temporary config for new auth compatibility
    AC_AUTH_HEADER_NAME = readString('AC_AUTH_HEADER_NAME', 'authorization-hs256');
    // <!-- deprecated, remove after migrating to new auth
    API_AUTH_URL = readString('API_AUTH_URL', 'http://api-router-internal');
    API_AUTH_ENDPOINT = readString('API_AUTH_ENDPOINT', '/private/access');
    // deprecated -->
}
