import { injectable, inject } from 'inversify';
import jsonwebtoken from 'jsonwebtoken';
import { JwksClient } from '../jwks';
import { FrameworkEnv } from '../env';
import { Logger } from '../logger';

@injectable()
export abstract class JwtService {
    abstract decodeAndVerify(token: string): Promise<DecodedJwt>;
}

@injectable()
export class AutomationCloudJwtService extends JwtService {
    protected jwksClient: JwksClient;

    constructor(
        @inject(FrameworkEnv)
        protected env: FrameworkEnv,
        @inject(Logger)
        protected logger: Logger,
    ) {
        super();
        const url = this.env.AC_JWKS_URL;
        const algorithm = this.env.AC_SIGNING_KEY_ALGORITHM;
        this.jwksClient = new JwksClient({
            url,
            algorithm,
            retryAttempts: 3,
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
