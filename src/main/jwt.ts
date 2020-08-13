import { injectable, inject } from 'inversify';
import jsonwebtoken from 'jsonwebtoken';
import { JwksClient } from './jwks';
import { FrameworkEnv } from './env';
import { Exception } from './exception';

@injectable()
export abstract class Jwt {
    abstract async decodeAndVerify(token: string): Promise<DecodedJwt>;
}

@injectable()
export class AutomationCloudJwt extends Jwt {
    protected client: JwksClient;
    constructor(
        @inject(FrameworkEnv)
        protected env: FrameworkEnv,
    ) {
        super();
        const url = this.env.AC_JWKS_URL;
        const algorithm = this.env.AC_SIGNING_KEY_ALGORITHM;

        if (!url || !algorithm) {
            throw new Exception({
                name: 'ConfigurationError',
                message: 'Check Environment: AC_JWKS_URL, AC_SIGNING_KEY_ALGORITHM',
            });
        }

        this.client = new JwksClient({
            url,
            algorithm,
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
