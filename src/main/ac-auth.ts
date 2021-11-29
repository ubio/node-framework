/* eslint-disable camelcase */

import { ClientError } from './exception';

export interface AcAuthSpec {
    jwtContext?: AcJwtContext;
}

export interface AcJwtContext {
    organisation_id?: string;
    service_account_id?: string;
    service_account_name?: string;
    user_id?: string;
    user_name?: string;
    client_id?: string;
    client_name?: string;
    job_id?: string;
}

export type AcRole = 'ServiceAccount' | 'User' | 'Client' | 'JobAccessToken';
export type AcActor = AcServiceAccount | AcUser | AcClient | AcJobAccessToken;

export interface AcServiceAccount {
    type: 'ServiceAccount';
    id: string;
    name?: string;
    clientId?: string;
    clientName?: string;
    organisationId?: string;
}

export interface AcUser {
    type: 'User';
    id: string;
    name?: string;
    organisationId: string;
}

export interface AcClient {
    type: 'Client';
    id: string;
    name?: string;
    organisationId: string;
}

export interface AcJobAccessToken {
    type: 'JobAccessToken';
    jobId: string;
    organisationId: string;
    clientId: string;
    clientName?: string;
}

export class AcAuth {
    readonly actor: AcActor | null = null;
    constructor(actor?: AcActor | null) {
        this.actor = actor ?? null;
    }

    isAuthenticated() {
        return this.actor != null;
    }

    checkAuthenticated(): void {
        if (!this.isAuthenticated()) {
            throw new AuthenticationError();
        }
    }

    getOrganisationId(): string | null {
        return this.actor?.organisationId ?? null;
    }

    requireOrganisationId(): string {
        const organisationId = this.getOrganisationId();
        if (!organisationId) {
            throw new AccessForbidden('organisationId is required');
        }
        return organisationId;
    }

    getClientId(): string | null {
        if (this.actor?.type === 'Client') {
            return this.actor.id;
        }
        if (this.actor?.type === 'ServiceAccount' && this.actor.clientId) {
            return this.actor.clientId;
        }
        return null;
    }

    requireClientId(): string {
        const clientId = this.getClientId();
        if (!clientId) {
            throw new AccessForbidden('clientId is required');
        }
        return clientId;
    }
}

export class AcAuthFactory {
    static createAuthByJwt(context: AcJwtContext) {
        const actor = parseActor(context);
        return new AcAuth(actor);
    }

    static createServiceAccountAuth(options: Omit<AcServiceAccount, 'type'>) {
        return new AcAuth({
            type: 'ServiceAccount',
            name: options.name ?? '',
            ...options,
        });
    }

    static createUserAuth(options: Omit<AcUser, 'type'>) {
        return new AcAuth({
            type: 'User',
            name: options.name ?? '',
            ...options,
        });
    }

    static createClientAuth(options: Omit<AcClient, 'type'>) {
        return new AcAuth({
            type: 'Client',
            name: options.name ?? '',
            ...options,
        });
    }

    static createJobAccessTokenAuth(jobId: string, options: Omit<AcJobAccessToken, 'type'>) {
        return new AcAuth({
            type: 'JobAccessToken',
            clientName: options.clientName ?? '',
            ...options,
        });
    }
}

function parseActor(jwtContext: AcJwtContext) {
    // Note: order matters
    return parseServiceAccount(jwtContext) ??
        parseJobAccessToken(jwtContext) ??
        parseClient(jwtContext) ??
        parseUser(jwtContext) ??
        null;
}

function parseServiceAccount(jwtContext: AcJwtContext): AcServiceAccount | null {
    if (jwtContext.service_account_id && jwtContext.service_account_name) {
        return {
            type: 'ServiceAccount',
            id: jwtContext.service_account_id,
            name: jwtContext.service_account_name,
            clientId: jwtContext.client_id,
            clientName: jwtContext.client_name,
            organisationId: jwtContext.organisation_id,
        };
    }
    return null;
}

function parseUser(jwtContext: AcJwtContext): AcUser | null {
    const { user_id, user_name, organisation_id } = jwtContext;
    if (user_id && organisation_id) {
        return {
            type: 'User',
            id: user_id,
            name: user_name ?? '',
            organisationId: organisation_id,
        };
    }
    return null;
}

function parseClient(jwtContext: AcJwtContext): AcClient | null {
    // if actor is jobAccessToken and claim AcClient, it should refuse it.
    if (jwtContext.job_id) {
        return null;
    }
    const { client_id, client_name, organisation_id } = jwtContext;
    if (client_id && organisation_id) {
        return {
            type: 'Client',
            id: client_id,
            name: client_name ?? '',
            organisationId: organisation_id,
        };
    }
    return null;
}

function parseJobAccessToken(jwtContext: AcJwtContext): AcJobAccessToken | null {
    const { job_id, client_id, client_name, organisation_id } = jwtContext;
    if (job_id && client_id && organisation_id) {
        return {
            type: 'JobAccessToken',
            jobId: job_id,
            clientId: client_id,
            clientName: client_name ?? '',
            organisationId: organisation_id,
        };
    }
    return null;
}


export class AuthenticationError extends ClientError {
    status = 401;
    message = 'Authentication is required';
}

export class AccessForbidden extends ClientError {
    status = 403;
}
