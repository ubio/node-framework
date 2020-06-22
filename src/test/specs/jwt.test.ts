import nock from 'nock';
import assert from 'assert';
import { KeycloakJwt } from '../../main/jwt';

describe('KeycloakJwt', () => {
    describe('getSigningKey', () => {
        let scope: nock.Scope;
        let jwt: KeycloakJwt;

        beforeEach(async () => {
            jwt = new KeycloakJwt();
            scope = nock('http://auth.example.com')
                .get('/.well-known/jwks.json')
                .reply(200, mockResponse);
        });

        afterEach(() => {
            nock.cleanAll();
        });

        it('fetches the key from the jwks endpoint', async () => {
            const decoded = { header: { kid }};
            await jwt.getSigningKey(decoded);
            assert.ok(scope.isDone());
        });

        it('retrieves the key from cache when called for the second time', async () => {
            const decoded = { header: { kid }};
            await jwt.getSigningKey(decoded);
            assert.ok(scope.isDone());

            // nock throws an error if it sends requests again
            await jwt.getSigningKey(decoded);
        });
    });
});

// copied over from jwks-rsa tests
const kid = 'NkFCNEE1NDFDNTQ5RTQ5OTE1QzRBMjYyMzY0NEJCQTJBMjJBQkZCMA';
const mockResponse = {
    keys: [
        {
        alg: 'RS256',
        kty: 'RSA',
        use: 'sig',
        nbf: 123,
        x5c: [
            'MIIDGzCCAgOgAwIBAgIJAPQM5+PwmOcPMA0GCSqGSIb3DQEBCwUAMCQxIjAgBgNVBAMMGXNhbmRyaW5vLWRldi5ldS5hdXRoMC5jb20wHhcNMTUwMzMxMDkwNTQ3WhcNMjgxMjA3MDkwNTQ3WjAkMSIwIAYDVQQDDBlzYW5kcmluby1kZXYuZXUuYXV0aDAuY29tMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAv/SECtT7H4rxKtX2HpGhSyeYTe3Vet8YQpjBAr+1TnQ1fcYfvfmnVRHvhmTwABktD1erF1lxFsrRw92yBDOHlL7lj1n2fcfLftSoStgvRHVg52kR+CkBVQ6/mF1lYkefIjik6YRMf55Eu4FqDyVG2dgd5EA8kNO4J8OPc7vAtZyXrRYOZjVXbEgyjje/V+OpMQxAHP2Er11TLuzJjioP0ICVqhAZdq2sLk7agoxn64md6fqOk4N+7lJkU4+412VD0qYwKxD7nGsEclYawKoZD9/xhCk2qfQ/HptIumrdQ5ox3Sq5t2a7VKa41dBUQ1MQtXG2iY7S9RlfcMIyQwGhOQIDAQABo1AwTjAdBgNVHQ4EFgQUHpS1fvO/54G2c1VpEDNUZRSl44gwHwYDVR0jBBgwFoAUHpS1fvO/54G2c1VpEDNUZRSl44gwDAYDVR0TBAUwAwEB/zANBgkqhkiG9w0BAQsFAAOCAQEAtm9I0nr6eXF5aq4yllfiqZcQ6mKrJLH9Rm4Jv+olniNynTcnpwprRVLToIawc8MmzIGZTtCn7u+dSxWf1UNE+SH7XgEnGtO74239vleEx1+Tf5viIdsnCxgvFiPdOqRlc9KcFSWd6a7RzcglnyU7GEx0K5GLv1wPA6qEM+3uwNwjAyVSu5dFw8kCfaSvlk5rXKRUzSoW9NVomw6+tADR8vMZS+4KThZ+4GH0rMN4KjIaRFxW8OMVYOn12uq33fLCd6MuPHW/rklxLbQBoHIU/ClNhbD0t6f00w9lHhPy4IP73rv7Oow0Ny6i70Iq0ijqj+kAtnrphlOvLFxqn6nCvQ=='
        ],
        n: 'v_SECtT7H4rxKtX2HpGhSyeYTe3Vet8YQpjBAr-1TnQ1fcYfvfmnVRHvhmTwABktD1erF1lxFsrRw92yBDOHlL7lj1n2fcfLftSoStgvRHVg52kR-CkBVQ6_mF1lYkefIjik6YRMf55Eu4FqDyVG2dgd5EA8kNO4J8OPc7vAtZyXrRYOZjVXbEgyjje_V-OpMQxAHP2Er11TLuzJjioP0ICVqhAZdq2sLk7agoxn64md6fqOk4N-7lJkU4-412VD0qYwKxD7nGsEclYawKoZD9_xhCk2qfQ_HptIumrdQ5ox3Sq5t2a7VKa41dBUQ1MQtXG2iY7S9RlfcMIyQwGhOQ',
        e: 'AQAB',
        kid,
        x5t: kid,
        }
    ]
};
