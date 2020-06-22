import { injectable } from 'inversify';
import util from 'util';
import assert from 'assert';
import jsonwebtoken from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import uuid from 'uuid';
import * as env from './env';

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

    constructor() {
        super();
        this.client = jwksClient({
            cache: true,
            rateLimit: true,
            cacheMaxEntries: 2,
            cacheMaxAge: 10 * 24 * 60 * 60 * 1000, // 10h
            jwksRequestsPerMinute: 10,
            jwksUri: env.readString('KEYCLOAK_JWKS_URI'),
        });
    }

    get issuer() {
        return env.readString('KEYCLOAK_ISSUER');
    }

    get audiences() {
        return env.readString('KEYCLOAK_AUDIENCE');
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
        const kid = decoded?.header?.kid;
        assert(kid, '.kid expected in jwt.header');

        const getSigningKey = util.promisify(this.client.getSigningKey);
        const key = await getSigningKey(kid);
        return key.getPublicKey();
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
