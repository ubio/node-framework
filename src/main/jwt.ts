import { injectable } from 'inversify';
import assert from 'assert';
import jsonwebtoken from 'jsonwebtoken';
import { JwksClient, JwksClientMock } from './jwks';
import * as env from './env';

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

        assert(JWKS_URL, 'env AC_JWKS_URL is missing');
        assert(JWKS_ALGORITHM, 'env AC_JWKS_ALGORITHM is missing');

        this.client = new JwksClient({
            url: JWKS_URL,
            algorithm: JWKS_ALGORITHM,
            retryAttempts: 3,
        });
    }

    async decodeAndVerify(token: string): Promise<DecodedJwt> {
        const secret = await this.client.getSigningKey();
        const verified = jsonwebtoken.verify(token, secret);

        return verified && typeof verified === 'object' ? verified : {};
    }
}

@injectable()
export class AutomationCloudJwtMock extends AutomationCloudJwt {
    constructor() {
        super();
        this.client = new JwksClientMock({
            url: env.readString('AC_JWKS_URL'),
            algorithm: env.readString('AC_JWKS_ALGORITHM'),
            retryAttempts: 3,
        });
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
