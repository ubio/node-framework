import { ClientError } from './exception';

export interface AcAuthSpec {
    authenticated: boolean;
    data: AcJwtContext,
};

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
}

export interface AcUser {
    type: 'User';
    id: string;
    name: string;
}
export interface AcClient {
    type: 'Client';
    id: string;
    name: string;
}

export interface AcJobAccessToken {
    type: 'JobAccessToken';
    job_id: string;
}

export class AcAuth {
    authenticated: boolean = false;
    data: AcJwtContext = {}
    constructor(spec?: AcAuthSpec) {
        this.authenticated = spec?.authenticated ?? false;
        this.data = spec?.data ?? {};
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
     * @deprecated use getServiceAccount() instead
     */
    getServiceAccountId(): string | null {
        return this.data.service_account_id ?? null;
    }

    /**
     * @deprecated use requireAuthorisedActor('ServiceAccount') or getServiceAccount() instead
     */
    requireServiceAccountId(): string {
        const serviceAccountId = this.data.service_account_id ?? null;
        if (!serviceAccountId) {
            throw new AccessForbidden('serviceAccountId is required');
        }

        return serviceAccountId;
    }

    /**
     * @param roles list of permitted roles. default to all.
     * @returns Authorised AcActor. Throws when authorised actor's role is not included in the list
     */
    requireAuthorisedActor(roles: AcRole[] = ['ServiceAccount', 'User', 'Client', 'JobAccessToken']) {
        const actor = this.getAuthorisedActor(roles);
        if (!actor) {
            throw new AccessForbidden('Insufficient peremission');
        }

        return actor;
    }

    /**
     * @param roles List of permitted roles. default to all.
     * @returns Authorised AcActor or null. Returns null when authorised actor's role is not included in the list
     */
    getAuthorisedActor(roles: AcRole[] = ['ServiceAccount', 'User', 'Client', 'JobAccessToken']): AcActor | null {
        for (const role of roles) {
            const actor = this.getActorByRole(role);
            if (actor != null) {
                return actor;
            }
        }
        return null;
    }

    /**
     *
     * @param role role of authorised actor
     * @returns AcActor or null. Returns null when not authorised or authorised user's role is different to given `role` param.
     */
    getActorByRole(role: AcRole): AcActor | null {
        switch (role) {
            case 'ServiceAccount':
                return this.getServiceAccount();
            case 'User':
                return this.getUser();
            case 'Client':
                return this.getClient();
            case 'JobAccessToken':
                return this.getJobAccessToken();
            default:
                return null;
        }
    }

    // explicit methods for calling each role
    getServiceAccount(): AcServiceAccount | null {
        if (this.data.service_account_id && this.data.service_account_name) {
            return {
                type: 'ServiceAccount',
                id: this.data.service_account_id,
                name: this.data.service_account_name,
            }
        }
        return null;
    }

    getUser(): AcUser | null {
        if (this.data.user_id && this.data.user_name) {
            return {
                type: 'User',
                id: this.data.user_id,
                name: this.data.user_name,
            };
        }
        return null;
    }

    getClient(): AcClient | null {
        if (this.data.client_id && this.data.client_name) {
            return {
                type: 'Client',
                id: this.data.client_id,
                name: this.data.client_name,
            }
        }

        return null;
    }

    getJobAccessToken(): AcJobAccessToken | null {
        if (this.data.job_id) {
            return {
                type: 'JobAccessToken',
                job_id: this.data.job_id,
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
