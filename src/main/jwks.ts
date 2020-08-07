import { Request } from '@automationcloud/request';
import assert from 'assert';
import { Exception } from './exception';
import { Response } from 'node-fetch';

export class JwksClient {
    protected _cache: Map<string, JwksCache> = new Map();

    constructor(protected options: JwksOptions) {}

    protected get request() {
        return new Request({
            baseUrl: this.options.url,
            retryAttempts: this.options.retryAttempts ?? 3,
        });
    }

    async getSigningKey(): Promise<string> {
        const alg = this.options.algorithm;
        const cached = this.cache.get(alg);
        if (cached) {
            return cached;
        }

        const res = await this.request.get('');
        const keys = this.decodeKeys(res);
        const key = keys.find(k => k.alg === this.options.algorithm);
        if (!key) {
            throw new Exception({
                name: 'SigningKeyNotFoundError',
                message: 'Expected signing key not found from response',
            });
        }

        this.cache.set(key.alg, key.k);

        return key.k;
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

    protected decodeKeys(res: { [k: string]: any }): AcSigningKey[] {
        const { keys } = res;
        assert(res.keys && Array.isArray(keys), '\'keys\' expected to be array');
        const decodedKeys: AcSigningKey[] = [];
        for (const key of keys) {
            if (key.alg && key.k) {
                decodedKeys.push({
                    use: key.use,
                    kty: key.kty,
                    kid: key.kid,
                    alg: key.alg,
                    k: key.k,
                });
            }
        }

        return decodedKeys;
    }
}

export class JwksClientMock extends JwksClient {
    protected get request() {
        return new Request({
            fetch: () => {
                const keys = [
                    {
                        "use": "enc",
                        "kty": "oct",
                        "kid": "services",
                        "alg": "HS256",
                        "k": "El62YCP5XEaBRY3oVAefGQ"
                    }
                ];

                const response = new Response(JSON.stringify({ keys }));
                return Promise.resolve(response);
            }
        });
    }
}

export interface JwksOptions {
    url: string;
    algorithm: string;
    retryAttempts?: number;
    cacheMaxAge?: number;
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
