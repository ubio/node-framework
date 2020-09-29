import { Exception } from './exception';

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
            throw new Exception({
                status: 401,
                name: 'AuthenticationError',
                message: 'Authentication is required',
            });
        }
    }

    getOrganisationId(): string | null {
        return this.organisationId;
    }

    requireOrganisationId(): string {
        if (!this.organisationId) {
            throw new Exception({
                status: 403,
                name: 'Forbidden',
                message: 'organisationId is required',
            });
        }
        return this.organisationId;
    }

    getServiceAccountId(): string | null {
        return this.serviceAccountId;
    }

    requireServiceAccountId(): string {
        if (!this.serviceAccountId) {
            throw new Exception({
                status: 403,
                name: 'Forbidden',
                message: 'serviceAccountId is required',
            });
        }
        return this.serviceAccountId;
    }

}
