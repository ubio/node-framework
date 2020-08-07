import { Container } from 'inversify';
import jsonwebtoken from 'jsonwebtoken';
import assert from 'assert';
import {
    Configuration,
    AuthService,
    Logger,
    ConsoleLogger,
    AutomationCloudAuthService,
    Jwt,
    AutomationCloudJwtMock,
    AutomationCloudDecodedJwt,
} from '../../../main';
import { RequestOptions } from '@automationcloud/request';
import { Response } from 'node-fetch';

describe('AutomationCloudAuthService', () => {
    let container: Container;
    let requestSent = false;
    let requestHeaders: any = {};
    let authService: AutomationCloudAuthService;

    beforeEach(() => {
        requestSent = false;
        requestHeaders = {};
        const fetchMock = (url: string, options: RequestOptions) => {
            requestSent = true;
            requestHeaders = options.headers;
            return Promise.resolve(new Response('{}'));
        }

        container = new Container({ skipBaseClassChecks: true });
        container.bind(Configuration).toSelf();
        container.bind(Logger).to(ConsoleLogger);
        container.bind(AuthService).to(AutomationCloudAuthService);
        container.bind(Jwt).to(AutomationCloudJwtMock).inSingletonScope();
        authService = container.get(AuthService) as AutomationCloudAuthService;
        authService.request.config.fetch = fetchMock;
    });

    context('ctx.headers[AC_AUTH_HEADER] exists', () => {
        const authHeader = process.env.AC_AUTH_HEADER || 'authorisation-hs256';
        const payload: AutomationCloudDecodedJwt = {
            context: {
                user_id: 'some-user',
                organisation_id: 'some-user-org-id',
            },
            authorization: {},
            authentication: {
                mechanism: 'client_credentials'
            },
        };

        beforeEach(async () => {
            authService = container.get(AuthService) as AutomationCloudAuthService;
            const secret = 'El62YCP5XEaBRY3oVAefGQ';
            const token = jsonwebtoken.sign(payload, secret, { algorithm: 'HS256' });
            const headers = {} as any;
            headers[authHeader] = 'Bearer ' + token;
            const ctx: any = { req: { headers } };

            await authService.authorize(ctx);
        })

        it('gets organisation_id from token', async () => {
            const organisationId = authService.getOrganisationId();
            assert.equal(organisationId, 'some-user-org-id');
        });

        it('does not send request', async () => {
            assert.equal(requestSent, false);
        });

    });

    context('authorization header exist & valid', () => {

        it('sends a request with Authorization header', async () => {
            const ctx: any = { req: { headers: { authorization: 'AUTH' } } };
            assert.equal(requestSent, false);
            await authService.authorize(ctx);
            assert.equal(requestSent, true);
            assert.equal(requestHeaders.authorization, 'AUTH');
        });

        it('does not send request if Authorization is cached', async () => {
            const ttl = 60000;
            const margin = 1000;

            authService.cacheTtl = ttl;
            authService.authorizedCache.set('AUTH', Date.now() - ttl + margin);
            const ctx: any = { req: { headers: { authorization: 'AUTH' } } };
            assert.equal(requestSent, false);
            await authService.authorize(ctx);
            assert.equal(requestSent, false);
        });

        it('still sends request if cache expires', async () => {
            const ttl = 60000;
            const margin = 1000;
            authService.cacheTtl = ttl;
            authService.authorizedCache.set('AUTH', Date.now() - ttl - margin);
            const ctx: any = { req: { headers: { authorization: 'AUTH' } } };
            assert.equal(requestSent, false);
            await authService.authorize(ctx);
            assert.equal(requestSent, true);
        });

    });

    context('authorization header does not exist', () => {

        it('throws AuthenticationError', async () => {
            const authService = container.get(AuthService);
            const ctx: any = { req: { headers: {} } };
            try {
                await authService.authorize(ctx);
                throw new Error('Unexpected success');
            } catch (err) {
                assert.equal(err.code, 'AuthenticationError');
                assert.equal(requestSent, false);
            }
        });

    });

});
