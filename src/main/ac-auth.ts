/* eslint-disable camelcase */

import { ClientError } from './exception';

export interface AcAuthSpec {
    authenticated: boolean;
    data: AcJwtContext;
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
    name: string;
    clientId?: string;
    clientName?: string;
    organisationId?: string;
}

export interface AcUser {
    type: 'User';
    id: string;
    name: string;
    organisationId: string;
}

export interface AcClient {
    type: 'Client';
    id: string;
    name: string;
    organisationId: string;
}

export interface AcJobAccessToken {
    type: 'JobAccessToken';
    jobId: string;
    organisationId: string;
    clientId: string;
    clientName: string;
}

export class AcAuth {
    authenticated: boolean = false;
    data: AcJwtContext = {};
    protected actor: AcActor | null = null;
    constructor(spec?: AcAuthSpec) {
        this.authenticated = spec?.authenticated ?? false;
        this.data = spec?.data ?? {};
        this.actor = this.getAuthorisedActor();
    }

    protected getAuthorisedActor() {
        // Note: order matters
        return this.getServiceAccount() ??
            this.getJobAccessToken() ??
            this.getClient() ??
            this.getUser() ??
            null;
    }

    isAuthenticated() {
        return this.authenticated;
    }

    checkAuthenticated(): void {
        if (!this.authenticated) {
            throw new AuthenticationError();
        }
    }

    getOrganisationId(): string | null {
        return this.data.organisation_id ?? null;
    }

    requireOrganisationId(): string {
        if (!this.data.organisation_id) {
            throw new AccessForbidden('organisationId is required');
        }
        return this.data.organisation_id;
    }

    /**
     * @deprecated use getActor('ServiceAccount') or getServiceAccount() instead
     */
    getServiceAccountId(): string | null {
        return this.getServiceAccount()?.id ?? null;
    }

    /**
     * @deprecated use requireActor('ServiceAccount') instead
     */
    requireServiceAccountId(): string {
        const serviceAccountId = this.getServiceAccount()?.id ?? null;
        if (!serviceAccountId) {
            throw new AccessForbidden('serviceAccountId is required');
        }

        return serviceAccountId;
    }

    /**
     * @param allowedRoles list of permitted roles.
     * @returns Authorised AcActor. Throws when not authorised or the actor doesn't meet the allowedRoles criteria
     */
    requireActor(...allowedRoles: AcRole[]) {
        const actor = this.getActor(...allowedRoles);
        if (!actor) {
            throw new AccessForbidden('Insufficient permission');
        }

        return actor;
    }

    /**
     * @param allowedRoles list of permitted roles.
     * @returns Authorised AcActor or null when authorised actor's role is not included or not authorised
     */
    getActor(...allowedRoles: AcRole[]): AcActor | null {
        if (this.actor && allowedRoles.includes(this.actor.type)) {
            return this.actor;
        }
        return null;
    }

    getServiceAccount(): AcServiceAccount | null {
        if (this.data.service_account_id && this.data.service_account_name) {
            return {
                type: 'ServiceAccount',
                id: this.data.service_account_id,
                name: this.data.service_account_name,
                clientId: this.data.client_id,
                clientName: this.data.client_name,
                organisationId: this.data.organisation_id,
            };
        }
        return null;
    }

    getUser(): AcUser | null {
        const { user_id, user_name, organisation_id } = this.data;
        if (user_id && user_name && organisation_id) {
            return {
                type: 'User',
                id: user_id,
                name: user_name,
                organisationId: organisation_id,
            };
        }
        return null;
    }

    getClient(): AcClient | null {
        // if actor is jobAccessToken and claim AcClient, it should refuse it.
        if (this.data.job_id) {
            return null;
        }
        const { client_id, client_name, organisation_id } = this.data;
        if (client_id && client_name && organisation_id) {
            return {
                type: 'Client',
                id: client_id,
                name: client_name,
                organisationId: organisation_id,
            };
        }

        return null;
    }

    getJobAccessToken(): AcJobAccessToken | null {
        const { job_id, client_id, client_name, organisation_id } = this.data;
        if (job_id && client_id && client_name && organisation_id) {
            return {
                type: 'JobAccessToken',
                jobId: job_id,
                clientId: client_id,
                clientName: client_name,
                organisationId: organisation_id,
            };
        }
        return null;
    }
}

export class AuthenticationError extends ClientError {
    status = 401;
    message = 'Authentication is required';
}

export class AccessForbidden extends ClientError {
    status = 403;
}
