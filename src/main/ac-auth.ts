import { ClientError } from './exception';

export interface AcAuthSpec {
    authenticated: boolean;
    organisationId: string | null;
    serviceAccountId: string | null;
}

export class AcAuth {
    protected authenticated: boolean = false;
    protected organisationId: string | null = null;
    protected serviceAccountId: string | null = null;

    constructor(spec: Partial<AcAuthSpec> = {}) {
        Object.assign(this, spec);
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
        return this.organisationId;
    }

    requireOrganisationId(): string {
        if (!this.organisationId) {
            throw new AccessForbidden('organisationId is required');
        }
        return this.organisationId;
    }

    getServiceAccountId(): string | null {
        return this.serviceAccountId;
    }

    requireServiceAccountId(): string {
        if (!this.serviceAccountId) {
            throw new AccessForbidden('serviceAccountId is required');
        }
        return this.serviceAccountId;
    }

}

export class AuthenticationError extends ClientError {
    status = 401;
    message = 'Authentication is required';
}

export class AccessForbidden extends ClientError {
    status = 403;
}
