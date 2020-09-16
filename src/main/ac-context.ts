import { Exception } from './exception';

export class AutomationCloudContext {
    protected authenticated: boolean = false;
    protected organisationId: string | null = null;

    isAuthenticated() {
        return this.authenticated;
    }

    checkAutheticated(): void {
        if (!this.authenticated) {
            throw new Exception({
                name: 'AuthenticationError',
                message: 'Authentication is required',
                status: 401,
            });
        }
    }

    getOrganisationId(): string | null {
        return this.organisationId;
    }

    requireOrganisationId(): string {
        if (!this.organisationId) {
            throw new Exception({
                name: 'AuthenticationError',
                message: 'OrganisationId is required',
                status: 401,
            });
        }
        return this.organisationId;
    }

    set(details: {
        authenticated: boolean;
        organisationId: string | null;
    }) {
        Object.assign(this, details);
    }

}
