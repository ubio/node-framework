import { Exception } from './exception';

export class AutomationCloudContext {
    protected authenticated: boolean = false;
    protected organisationId: string | null = null;
    protected serviceUserAccount: string | null = null;

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

    getServiceUserAccount(): string | null {
        return this.serviceUserAccount;
    }

    requireServiceUserAccount(): string {
        if (!this.serviceUserAccount) {
            throw new Exception({
                status: 403,
                name: 'Forbidden',
                message: 'ServiceUserAccount is required',
            });
        }
        return this.serviceUserAccount;
    }

    set(details: {
        authenticated: boolean;
        organisationId: string | null;
        serviceUserAccount: string | null;
    }) {
        Object.assign(this, details);
    }

}
