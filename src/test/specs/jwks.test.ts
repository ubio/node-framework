import nock from 'nock';
import assert from 'assert';
import { JwksClient } from '../../main/jwks';

describe('JwksClient', () => {
    describe('getSigningKey', () => {
        let scope: nock.Scope;
        let jwksClient: JwksClient;

        const mockUrl = 'http://auth.example.com';
        const algorithm = 'HS256';
        const mockResponse = {
            keys: [
                {
                    "use": "enc",
                    "kty": "oct",
                    "kid": "services",
                    "alg": "HS256",
                    "k": "El62YCP5XEaBRY3oVAefGQ"
                },
            ]
        };

        beforeEach(async () => {
            jwksClient = new JwksClient({
                url: mockUrl,
                retryAttempts: 1,
                algorithm,
            });

            scope = nock('http://auth.example.com')
                .get('/')
                .reply(200, mockResponse);
        });

        afterEach(() => {
            nock.cleanAll();
        });

        it('fetches the key from the jwks endpoint', async () => {
            await jwksClient.getSigningKey();
            assert.ok(scope.isDone());
        });

        it('retrieves the key from cache when called for the second time', async () => {
            await jwksClient.getSigningKey();
            assert.ok(scope.isDone());

            // nock throws an error if it sends requests again
            await jwksClient.getSigningKey();
        });

        context('value in cache is stale', () => {
            beforeEach(() => {
                jwksClient.cache.set(algorithm, 'i-am-stale', -1000);
            });

            it('sends request', async () => {
                const key = await jwksClient.getSigningKey();
                assert.notEqual(key, 'i-am-stale');
                assert.ok(scope.isDone());
            });

            it('sets new key in cache', async () => {
                const key = await jwksClient.getSigningKey();
                assert.equal(key, jwksClient.cache.get(algorithm));
            });
        });
    });
});
