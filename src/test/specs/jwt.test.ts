import assert from 'assert';
import jsonwebtoken from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuid } from 'uuid';

import { FrameworkEnv } from '../../main/env';
import { ConsoleLogger, AutomationCloudJwtService } from '../../main';

describe('AutomationCloudJwt', () => {
    describe('decodeAndVerify', () => {
        let jwtService: AutomationCloudJwtService;
        let secretKey: string;
        const payload = {
            context: {
                user_id: 'some-user',
                organisation_id: 'some-user-org-id',
            },
            authorization: {},
            authentication: {
                mechanism: 'client_credentials'
            }
        };

        beforeEach(async () => {
            const env = new FrameworkEnv();
            jwtService = new AutomationCloudJwtService(env, new ConsoleLogger());
            secretKey = getSecretKey();
            (jwtService as any).jwksClient.getSigningKey = async () => secretKey;
        });

        it('decodes data with given token', async () => {
            const token = jsonwebtoken.sign(payload, secretKey, { algorithm: 'HS256' });
            const decoded = await jwtService.decodeAndVerify(token);

            assert.deepEqual(decoded.context, payload.context);
            assert.deepEqual(decoded.authorization, payload.authorization);
            assert.deepEqual(decoded.authentication, payload.authentication);
        });

        it('throws when secret is wrong', async () => {
            const token = jsonwebtoken.sign(payload, 'wrong-secret', { algorithm: 'HS256' });
            try {
                await jwtService.decodeAndVerify(token);
                assert.ok(true, 'Unexpected success');
            } catch (err) {
                assert.equal(err.name, 'JsonWebTokenError');
                assert.equal(err.message, 'invalid signature');
            }
        });

        it('throws when jwt is expired', async () => {
            const token = jsonwebtoken.sign(payload, secretKey, { algorithm: 'HS256', expiresIn: '-1h' });
            try {
                await jwtService.decodeAndVerify(token);
                assert.ok(true, 'Unexpected success');
            } catch (err) {
                assert.equal(err.name, 'TokenExpiredError');
                assert.equal(err.message, 'jwt expired');
            }
        });

    });
});

function getSecretKey() {
    const hmac = crypto.createHmac('sha256', uuid());
    hmac.update('some-encrypted-data');
    return hmac.digest('hex');
}
