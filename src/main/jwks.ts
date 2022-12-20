import { Request } from '@ubio/request';
import Ajv from 'ajv';

import { ClientError, Exception } from './exception.js';
import { ajvErrorToMessage } from './util.js';

const ajv = new Ajv.default({
    allErrors: true,
    useDefaults: true,
    validateFormats: false,
});

const jwksSchema = {
    type: 'object',
    properties: {
        keys: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    use: { type: 'string' },
                    kty: { type: 'string' },
                    kid: { type: 'string' },
                    k: { type: 'string' },
                    alg: {
                        type: 'string',
                        enum: [
                            'HS256', 'HS384', 'HS512',
                            'RS256', 'RS384', 'RS512',
                            'ES256', 'ES384', 'ES512',
                            'PS256', 'PS384', 'PS512'
                        ]
                    },
                },
                required: ['alg', 'k', 'kid']
            }
        }
    },
    required: ['keys'],
    additionalProperties: true
};

const validateFunction = ajv.compile(jwksSchema);

export class JwksClient {
    protected _cache: JwksCache | null = null;
    request: Request;

    constructor(protected options: JwksOptions) {
        this.options = options;
        this.request = new Request({
            retryAttempts: this.options.retryAttempts ?? 3,
        });
    }

    async getSigningKey(): Promise<string> {
        const keys = await this.getSigningKeys();
        const alg = this.options.algorithm;
        const matchingKey = keys.find(k => k.alg === alg && k.kid === 'services');
        if (!matchingKey) {
            this.clearCache();
            throw new SigningKeyNotFoundError();
        }
        return matchingKey.k;
    }

    async getSigningKeys(): Promise<SigningKey[]> {
        const { keys, validUntil = 0 } = this._cache || {};
        if (keys && Date.now() < validUntil) {
            return keys;
        }

        const res = await this.request.get(this.options.url);
        const validRes = this.validateResponse(res);
        this.setCache(validRes.keys);

        return validRes.keys;
    }

    getCache() {
        return this._cache == null ? null : { ...this._cache };
    }

    setCache(keys: SigningKey[], maxAge?: number) {
        const ttl = maxAge ??
            this.options.cacheMaxAge ??
            60 * 60 * 1000;

        const validUntil = Date.now() + ttl;
        this._cache = { keys, validUntil };
    }

    clearCache() {
        this._cache = null;
    }

    protected validateResponse(res: { [k: string]: any }): SigningKeySets {
        if (validateFunction(res) === true) {
            return res as SigningKeySets;
        }
        const errors = validateFunction.errors || [];
        const messages = errors.map(e => ajvErrorToMessage(e));
        throw new JwksValidationError(messages);
    }
}

export interface JwksOptions {
    url: string;
    algorithm: string;
    cacheMaxAge?: number;
    retryAttempts?: number;
}

export type JwksCache = SigningKeySets & { validUntil: number };

export interface SigningKeySets {
    keys: SigningKey[];
}

export interface SigningKey {
    use?: string;
    kty?: string;
    kid: string;
    alg: string;
    k: string;
}

export class SigningKeyNotFoundError extends Exception {
    override message = 'Expected signing key not found in JWKS response';
}

export class JwksValidationError extends ClientError {
    override message = 'JWKS validation failed';
    constructor(messages: string[]) {
        super();
        this.details = {
            messages
        };
    }
}
