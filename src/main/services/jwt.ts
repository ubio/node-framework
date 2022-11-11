import { config } from '@flexent/config';
import { Logger } from '@flexent/logger';
import { dep } from '@flexent/mesh';
import jsonwebtoken from 'jsonwebtoken';

import { JwksClient } from '../jwks.js';

export abstract class JwtService {
    abstract decodeAndVerify(token: string): Promise<DecodedJwt>;
}

export class AutomationCloudJwtService extends JwtService {

    @config({ default: 'http://hydra.authz.svc.cluster.local:4445/keys/internal' })
    AC_JWKS_URL!: string;
    @config({ default: 'HS256' })
    AC_SIGNING_KEY_ALGORITHM!: string;
    @config({ default: 60 * 60 * 1000 })
    AC_JWKS_CACHE_MAX_AGE!: number;

    @dep() protected logger!: Logger;

    protected jwksClient: JwksClient;

    constructor() {
        super();
        const url = this.AC_JWKS_URL;
        const algorithm = this.AC_SIGNING_KEY_ALGORITHM;
        const cacheMaxAge = this.AC_JWKS_CACHE_MAX_AGE;
        this.jwksClient = new JwksClient({
            url,
            algorithm,
            retryAttempts: 3,
            cacheMaxAge,
        });
    }

    async decodeAndVerify(token: string): Promise<DecodedJwt> {
        const secret = await this.jwksClient.getSigningKey();
        const verified = jsonwebtoken.verify(token, secret);
        return verified && typeof verified === 'object' ? verified : {};
    }
}

export type DecodedJwt = {
    [key: string]: any;
};
