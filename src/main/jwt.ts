import assert from 'assert';
import jsonwebtoken from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { injectable, inject } from 'inversify';
import { Configuration, stringConfig } from './config';
import uuid from 'uuid';

const KEYCLOAK_ISSUER = stringConfig('KEYCLOAK_ISSUER', '');
const KEYCLOAK_JWKS_URI = stringConfig('KEYCLOAK_JWKS_URI', '');
const KEYCLOAK_AUDIENCE = stringConfig('KEYCLOAK_AUDIENCE', '');

export type DecodedJwt = {
    [key: string]: any;
};

@injectable()
export abstract class Jwt {
    abstract async decodeAndVerify(token: string): Promise<DecodedJwt>;
}

@injectable()
export class KeycloakJwt extends Jwt {
    client: jwksClient.JwksClient;

    constructor(
        @inject(Configuration)
        protected config: Configuration
    ) {
        super();
        this.client = jwksClient({
            cache: true,
            rateLimit: true,
            cacheMaxEntries: 5,
            cacheMaxAge: 10 * 24 * 60 * 60 * 1000, // 10h
            jwksRequestsPerMinute: 10,
            jwksUri: config.get(KEYCLOAK_JWKS_URI),
        });
    }

    get issuer() {
        return this.config.get(KEYCLOAK_ISSUER);
    }

    get audiences() {
        return this.config.get(KEYCLOAK_AUDIENCE);
    }

    async decodeAndVerify(token: string) {
        const decoded = this.decode(token);
        return await this.verify(token, decoded);
    }

    decode(token: string) {
        const decoded = jsonwebtoken.decode(token, { complete: true });
        return decoded && typeof decoded === 'object' ? decoded : {};
    }

    async verify(token: string, decoded: DecodedJwt): Promise<DecodedJwt> {
        assert(this.issuer === decoded?.payload?.iss, 'Invalid Jwt issuer');

        const cert = await this.getSigningKey(decoded);
        const audience = this.audiences.split(',').map((str) => str.trim());

        const verified = jsonwebtoken.verify(token, cert, { audience, issuer: this.issuer });

        return verified && typeof verified === 'object' ? verified : {};
    }

    async getSigningKey(decoded: DecodedJwt): Promise<string> {
        return new Promise((resolve, reject) => {
            const kid = decoded?.header?.kid;
            assert(kid, '.kid expected in jwt.header');

            this.client.getSigningKey(kid, (err, key) => {
                if (err) {
                    return reject(err);
                }
                resolve(key.getPublicKey());
            });
        });
    }

}

@injectable()
export class KeycloakJwtMock extends KeycloakJwt {
    secrets: Map<string, string> = new Map();

    createToken(payload: { [key: string]: string }) {
        const secret = uuid.v4();
        const token = jsonwebtoken.sign(payload, secret);
        this.secrets.set(token, secret);
        return token;
    }

    clearSecrets() {
        this.secrets.clear();
    }

    async decodeAndVerify(token: string) {
        const secret = this.secrets.get(token);
        if (!secret) {
            throw new Error('Unknown token');
        }

        const verified = jsonwebtoken.verify(token, secret);
        return verified && typeof verified === 'object' ? verified : {};
    }
}
