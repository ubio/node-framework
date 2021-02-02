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
    HTTP_JSON_LIMIT = readString('HTTP_JSON_LIMIT', '5mb');
    HTTP_FORM_LIMIT = readString('HTTP_FORM_LIMIT', '1mb');
    HTTP_MAX_FILE_SIZE_BYTES = readNumber('HTTP_MAX_FILE_SIZE_BYTES', 50 * 1024 * 1024);
    HTTP_SHUTDOWN_DELAY = readNumber('HTTP_SHUTDOWN_DELAY', 10000);
    METRICS_REFRESH_INTERVAL = readNumber('METRICS_REFRESH_INTERVAL', 30000);
    API_JOB_TIMELINE_URL = readString('API_JOB_TIMELINE_URL', 'http://api-job-timeline');
    API_JOB_TIMELINE_KEY = readString('API_JOB_TIMELINE_KEY', ''); // to avoid assert error when not used
    // temporary config for new auth compatibility
    AC_AUTH_HEADER_NAME = readString('AC_AUTH_HEADER_NAME', 'x-ubio-auth');
    AC_AUTH_VERIFY_URL = readString('AC_AUTH_MIDDLEWARE_URL', 'http://auth-middleware.authz.svc.cluster.local:8080/verify');
    AC_JWKS_URL = readString('AC_JWKS_URL', 'http://hydra.authz.svc.cluster.local:4445/keys/internal');
    AC_SIGNING_KEY_ALGORITHM = readString('SIGNING_KEY_ALGORITHM', 'HS256');

    MONGO_URL = readString('MONGO_URL', '');
}
