import { FetchMock, fetchMock } from '@automationcloud/request';
import assert from 'assert';

import { JwksClient } from '../../main/jwks';

describe('JwksClient', () => {
    describe('getSigningKey', () => {
        let jwksClient: JwksClient;
        let fetch: FetchMock;
        const mockUrl = 'http://auth.example.com';
        const algorithm = 'HS256';
        const happyKey = {
            alg: algorithm,
            use: 'enc',
            kty: 'oct',
            kid: 'services',
            k: 'i-am-some-key',
        };

        beforeEach(async () => {
            fetch = fetchMock({ status: 200 }, { keys: [happyKey] });
            jwksClient = new JwksClient({
                url: mockUrl,
                retryAttempts: 1,
                algorithm,
            });
            jwksClient.request.config.fetch = fetch;
            jwksClient.clearCache();

        });

        it('fetches the key from the jwks endpoint', async () => {
            await jwksClient.getSigningKey();
            assert.ok(fetch.spy.called);
            assert.strictEqual(fetch.spy.calledCount, 1);
        });

        it('retrieves the key from cache when called for the second time', async () => {
            await jwksClient.getSigningKey();
            await jwksClient.getSigningKey();

            assert.ok(fetch.spy.called);
            assert.strictEqual(fetch.spy.calledCount, 1);
        });

        context('value in cache is stale', () => {
            beforeEach(() => {
                const keys = [{
                    alg: algorithm,
                    k: 'i-am-stale',
                    kid: 'services',
                }];

                jwksClient.setCache(keys, -1000);
            });

            it('sends request', async () => {
                const key = await jwksClient.getSigningKey();
                assert.notStrictEqual(key, 'i-am-stale');
                assert.ok(fetch.spy.called);
            });

            it('sets new key in cache', async () => {
                const key = await jwksClient.getSigningKey();
                const cache = jwksClient.getCache();
                const cachedKey = cache?.keys.find(_ => _.k === key);
                assert.strictEqual(key, cachedKey?.k);
            });
        });

        describe('configurable cache timeout', () => {
            it('sets default value (1hour) if not specified', async () => {
                await jwksClient.getSigningKey();
                const cache = jwksClient.getCache();
                assert.ok(cache);
                assert.strictEqual(Math.round((cache.validUntil - Date.now()) / 1000), 3600);
            });

            it('caches keys for specified amount of time', async () => {
                jwksClient = new JwksClient({
                    url: mockUrl,
                    retryAttempts: 1,
                    algorithm,
                    cacheMaxAge: 60 * 1000
                });
                jwksClient.request.config.fetch = fetchMock({ status: 200 }, { keys: [happyKey] });

                await jwksClient.getSigningKey();
                const cache = jwksClient.getCache();
                assert.ok(cache);
                assert.strictEqual(Math.round((cache.validUntil - Date.now()) / 1000), 60);
            });
        });

        context('response is invalid', () => {
            it('throws when matching alg not found', async () => {
                const wrongAlg = { ...happyKey, alg: 'ES256' };
                jwksClient.request.config.fetch = fetchMock({ status: 200 }, { keys: [wrongAlg] });

                try {
                    await jwksClient.getSigningKey();
                    assert(true, 'unexpected success');
                } catch (error) {
                    assert.strictEqual(error.name, 'SigningKeyNotFoundError');
                }
            });

            it('throws when kid !== services', async () => {
                const wrongKid = { ...happyKey, kid: 'some-other-kid' };
                const fetch = fetchMock({ status: 200 }, { keys: [wrongKid] });
                jwksClient.request.config.fetch = fetch;

                try {
                    await jwksClient.getSigningKey();
                    assert(true, 'unexpected success');
                } catch (error) {
                    assert.equal(error.name, 'SigningKeyNotFoundError');
                }
            });

            it('throws when .alg is missing', async () => {
                const noAlg = { ...happyKey, alg: undefined };
                jwksClient.request.config.fetch = fetchMock({ status: 200 }, { keys: [noAlg] });

                try {
                    await jwksClient.getSigningKey();
                    assert(true, 'unexpected success');
                } catch (error) {
                    assert.equal(error.name, 'JwksValidationError');
                    assert.ok(error.details.messages[0].includes('alg'));
                }
            });

            it('throws when .k is missing', async () => {
                const noK = { ...happyKey, k: undefined };
                const fetch = fetchMock({ status: 200 }, { keys: [noK] });
                jwksClient.request.config.fetch = fetch;

                try {
                    await jwksClient.getSigningKey();
                    assert(true, 'unexpected success');
                } catch (error) {
                    assert.strictEqual(error.name, 'JwksValidationError');
                    assert.ok(error.details.messages[0].includes('k'));
                }
            });

            it('throws when .kid is missing', async () => {
                const noKid = { ...happyKey, kid: undefined };
                const fetch = fetchMock({ status: 200 }, { keys: [noKid] });
                jwksClient.request.config.fetch = fetch;

                try {
                    await jwksClient.getSigningKey();
                    assert(true, 'unexpected success');
                } catch (error) {
                    assert.strictEqual(error.name, 'JwksValidationError');
                    assert.ok(error.details.messages[0].includes('k'));
                }
            });

            it('does not throws when optional field is missing', async () => {
                const noOptional = {
                    ...happyKey,
                    use: undefined,
                    kty: undefined,
                };

                jwksClient.request.config.fetch = fetchMock({ status: 200 }, { keys: [noOptional] });

                try {
                    await jwksClient.getSigningKey();
                    assert(true, 'unexpected success');
                } catch (error) {
                    assert.strictEqual(error.name, 'JwksValidationError');
                    assert.ok(error.details.messages[0].includes('k'));
                }
            });
        });
    });
});
