import Ajv from 'ajv';
import { Request, Fetch } from '@automationcloud/request';
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
    protected _cache: JwksCache | null = null;
    request: Request;

    constructor(protected options: JwksOptions) {
        this.options = options;
        this.request = new Request({
            retryAttempts: this.options.retryAttempts ?? 3,
            fetch: this.options.fetch,
        });
    }

    async getSigningKey(): Promise<string> {
        const keys = await this.getSigningKeys();
        const alg = this.options.algorithm;
        const matchingKey = keys.find(k => k.alg === alg && k.kid === 'services');
        if (!matchingKey) {
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
            60 * 1000;

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
    fetch?: Fetch;
}

export type JwksCache = SigningKeySets & { validUntil: number }

export interface SigningKeySets {
    keys: SigningKey[]
}

export interface SigningKey {
    use?: string;
    kty?: string;
    kid: string;
    alg: string;
    k: string;
}

export class SigningKeyNotFoundError extends Exception {
    message = 'Expected signing key not found from response';
}

export class JwksValidationError extends Exception {
    message = 'JWKS validation failed';
    constructor(messages: string[]) {
        super();
        this.details = {
            messages
        };
    }
}
