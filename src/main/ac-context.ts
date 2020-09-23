import { Exception } from './exception';

export class AutomationCloudContext {
    protected authenticated: boolean = false;
    protected organisationId: string | null = null;
    protected serviceAccountId: string | null = null;

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
                message: 'OrganisationId is required',
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
                message: 'ServiceAccountId is required',
            });
        }
        return this.serviceAccountId;
    }

    set(details: {
        authenticated: boolean;
        organisationId: string | null;
        serviceAccountId: string | null;
    }) {
        Object.assign(this, details);
    }

}
