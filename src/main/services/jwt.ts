import { inject, injectable } from 'inversify';
import jsonwebtoken from 'jsonwebtoken';

import { Config, config } from '../config';
import { JwksClient } from '../jwks';
import { Logger } from '../logger';

@injectable()
export abstract class JwtService {
    abstract decodeAndVerify(token: string): Promise<DecodedJwt>;
}

@injectable()
export class AutomationCloudJwtService extends JwtService {
    protected jwksClient: JwksClient;

    @config({ default: 'http://hydra.authz.svc.cluster.local:4445/keys/internal' })
    AC_JWKS_URL!: string;
    @config({ default: 'HS256' })
    AC_SIGNING_KEY_ALGORITHM!: string;
    @config({ default: 60 * 60 * 1000 })
    AC_JWKS_CACHE_MAX_AGE!: number;

    constructor(
        @inject(Config)
        public config: Config,
        @inject(Logger)
        protected logger: Logger,
    ) {
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
}
