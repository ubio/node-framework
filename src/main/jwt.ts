import { injectable } from 'inversify';
import jsonwebtoken from 'jsonwebtoken';
import { JwksClient } from './jwks';
import * as env from './env';
import { Exception } from './exception';

@injectable()
export abstract class Jwt {
    abstract async decodeAndVerify(token: string): Promise<DecodedJwt>;
}

@injectable()
export class AutomationCloudJwt extends Jwt {
    protected client: JwksClient;
    constructor() {
        super();
        const JWKS_URL = env.readString('AC_JWKS_URL');
        const JWKS_ALGORITHM = env.readString('AC_JWKS_ALGORITHM');

        if (!JWKS_URL || !JWKS_ALGORITHM) {
            throw new Exception({
                name: 'ConfigurationError',
                message: 'AC_JWKS_URL and AC_JWKS_ALGORITHM is required for AutomationCloudJwt',
            })
        }

        this.client = new JwksClient({
            url: JWKS_URL,
            algorithm: JWKS_ALGORITHM,
            retryAttempts: 3,
        });
    }

    get jwksClient() { return this.client; }

    async decodeAndVerify(token: string): Promise<DecodedJwt> {
        const secret = await this.client.getSigningKey();
        const verified = jsonwebtoken.verify(token, secret);

        return verified && typeof verified === 'object' ? verified : {};
    }
}

export type DecodedJwt = {
    [key: string]: any;
}

export type AutomationCloudDecodedJwt = {
    context: {
        organisation_id?: string;
        user_id?: string;
        job_id?: string;
    },
    authentication: {
        mechanism: string;
        service?: string;
    },
    authorization: unknown;
}
