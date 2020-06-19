import assert from 'assert';
import util from 'util';
import jsonwebtoken from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { injectable, inject } from 'inversify';
import { Configuration, stringConfig } from './config';
import uuid from 'uuid';

const KEYCLOAK_ISSUER = stringConfig('KEYCLOAK_ISSUER', '');
const KEYCLOAK_JWKS_URI = stringConfig('KEYCLOAK_JWKS_URI', '');
const KEYCLOAK_AUDIENCE = stringConfig('KEYCLOAK_AUDIENCE', '');

export type DecodedJWT = {
    [key: string]: any;
};

export type IssuerConfig = {
    issuer: string;
    jwksUri: string;
    audiences: string;
}

@injectable()
export abstract class JWT {
    abstract async decodeAndVerify(token: string): Promise<DecodedJWT>;
}

@injectable()
export class KeycloakJWT extends JWT {
    constructor(
        @inject(Configuration)
        protected config: Configuration
    ) {
        super();
    }

    getIssuerConfig() {
        const issuer = this.config.get(KEYCLOAK_ISSUER);
        const jwksUri = this.config.get(KEYCLOAK_JWKS_URI);
        const audiences = this.config.get(KEYCLOAK_AUDIENCE);
        return {
            issuer,
            jwksUri,
            audiences,
        };
    }

    async decodeAndVerify(token: string) {
        const decoded = this.decode(token);
        const config = this.getIssuerConfig();
        return await this.verify(token, decoded, config);
    }

    decode(token: string) {
        const decoded = jsonwebtoken.decode(token, { complete: true });
        return decoded && typeof decoded === 'object' ? decoded : {};
    }

    async verify(token: string, decoded: DecodedJWT, config: IssuerConfig): Promise<DecodedJWT> {
        assert(config.issuer !== decoded?.payload?.iss, 'Invalid JWT issuer');

        const cert = await this.getSigningKey(decoded, config);
        const audience = config.audiences.split(',').map((str) => str.trim());

        const verified = jsonwebtoken.verify(token, cert, { audience, issuer: config.issuer });

        return verified && typeof verified === 'object' ? verified : {};
    }

    async getSigningKey(decoded: DecodedJWT, config: IssuerConfig) {
        const kid = decoded?.header?.kid;
        assert(kid, '.kid expected in jwt.header');

        const client = jwksClient({
            cache: true,
            cacheMaxEntries: 5,
            cacheMaxAge: 10 * 24 * 60 * 60 * 1000, // 10h
            jwksRequestsPerMinute: 10,
            jwksUri: config.jwksUri,
        });

        const jwtGetSigningKey = util.promisify(client.getSigningKey);
        const key = await jwtGetSigningKey(kid);

        return key.getPublicKey();
    }

}

@injectable()
export class KeycloakJWTMock extends KeycloakJWT {
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
