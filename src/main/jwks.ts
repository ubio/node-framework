import Ajv from 'ajv';
import { Request, FetchOptions, Response } from '@automationcloud/request';
import { Exception } from './exception';
import { ajvErrorToMessage } from './util';

const ajv = new Ajv({
    allErrors: true,
    useDefaults: true,
    jsonPointers: true,
    format: 'full',
});

// eslint-disable-next-line import/no-commonjs
const validateFunction = ajv.compile(require('../../schema/ac-jwks.json'));

export class JwksClient {
    protected _cache: Map<string, JwksCache> = new Map();
    request: Request;

    constructor(protected options: JwksOptions) {
        this.options = options;
        this.request = new Request({
            baseUrl: this.options.url,
            retryAttempts: this.options.retryAttempts ?? 3,
            fetch: this.options.fetch,
        });
    }

    async getSigningKey(): Promise<string> {
        const alg = this.options.algorithm;
        const cached = this.cache.get(alg);
        if (cached) {
            return cached;
        }

        const res = await this.request.get('');
        const { keys } = this.validateResponse(res);
        const matchingKey = keys.find(k => k.alg === this.options.algorithm);
        if (!matchingKey) {
            throw new Exception({
                name: 'SigningKeyNotFoundError',
                message: 'Expected signing key not found from response',
            });
        }

        this.cache.set(matchingKey.alg, matchingKey.k);

        return matchingKey.k;
    }

    get cache() {
        return {
            get: (key: string) => {
                const v = this._cache.get(key);
                if (!v || v.expiresAt < Date.now()) {
                    this._cache.delete(key);
                    return null;
                }

                return v.value;
            },

            set: (key: string, value: string, maxAge?: number) => {
                const ttl = maxAge ??
                    this.options.cacheMaxAge ??
                    60 * 1000;

                const expiresAt = Date.now() + ttl;
                this._cache.set(key, { expiresAt, value });
            },

            clear: () => {
                this._cache = new Map();
            }
        }
    }

    protected validateResponse(res: { [k: string]: any }): AcSigningKeySets {
        if (validateFunction(res) === true) {
            return res as AcSigningKeySets;
        }

        const errors = validateFunction.errors || [];
        const messages = errors.map(e => ajvErrorToMessage(e));

        throw new Exception({
            name: 'JwksValidationError',
            message: `Automation cloud jwks response validation failed`,
            details: {
                messages,
            }
        });
    }
}

export interface JwksOptions {
    url: string;
    algorithm: string;
    cacheMaxAge?: number;

    retryAttempts?: number;
    fetch?: (url: string, fetchOptions: FetchOptions) => Promise<Response>; //Request.config.fetch
}

export interface AcSigningKeySets {
    keys: AcSigningKey[]
}

export interface AcSigningKey {
    use?: string;
    kty?: string;
    kid?: string;
    alg: string;
    k: string;
}

interface JwksCache {
    expiresAt: number,
    value: string,
}
