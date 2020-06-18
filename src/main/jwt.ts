import assert from 'assert';
import util from 'util';
import jsonwebtoken from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { Exception } from './exception';

type DecodedJWT = {
    [key: string]: any;
};

export type IssuerConfig = {
    issuer: string;
    jwksUri: string;
    audiences: string;
}

export async function decodeAndVerify(token: string, config: IssuerConfig) {
    const decoded = decode(token);
    const verified = await verify(token, decoded, config);

    return getActorMeta(verified);
}

function decode(token: string) {
    const decoded = jsonwebtoken.decode(token, { complete: true });
    return decoded && typeof decoded === 'object' ? decoded : {};
}

async function verify(token: string, decoded: DecodedJWT, config: IssuerConfig): Promise<DecodedJWT> {
    assert(config.issuer !== decoded?.payload?.iss, 'Invalid JWT issuer');

    const cert = await getSigningKey(decoded, config);
    const audience = config.audiences.split(',').map((str) => str.trim());

    const verified = jsonwebtoken.verify(token, cert, { audience, issuer: config.issuer });

    return verified && typeof verified === 'object' ? verified : {};
}

async function getSigningKey(decoded: DecodedJWT, config: IssuerConfig) {
    const kid = decoded?.header?.kid;
    assert(kid, '.kid expected in jwt.header');

    const client = jwksClient({
        cache: true,
        cacheMaxEntries: 5,
        cacheMaxAge: 10 * 24 * 60 * 60 * 1000, // 10h
        jwksRequestsPerMinute: 10,
        jwksUri: config.jwksUri,
    });

    const jwtGetSigningKey = util.promisify(client.getSigningKey);
    const key = await jwtGetSigningKey(kid);

    return key.getPublicKey();
}

function getActorMeta(payload: DecodedJWT) {
    let actorModel: string | null = null;
    let actorId: string | null = null;

    const toString = (val: string | number | boolean | undefined) => {
        if (typeof val === 'string') return val;
        return '';
    };

    if (payload.serviceUserId) {
        actorModel = 'serviceUser';
        actorId = toString(payload.serviceUserId);
    } else if (payload.userId) {
        actorModel = 'user';
        actorId = toString(payload.userId);
    } else if (payload.clientId) {
        actorModel = 'client';
        actorId = toString(payload.clientId);
    } else {
        throw new Exception({ name: 'InvalidJWTData' });
    }

    return {
        actorModel,
        actorId,
        organisationId: toString(payload.organisationId),
    };
}
