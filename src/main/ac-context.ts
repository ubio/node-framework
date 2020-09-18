import { Exception } from './exception';
import { AutomationCloudDecodedJwt } from './services/jwt';

export class AutomationCloudContext {
    protected authenticated: boolean = false;
    protected organisationId: string | null = null;
    protected jwt: AutomationCloudDecodedJwt | null = null;

    isAuthenticated() {
        return this.authenticated;
    }

    checkAuthenticated(): void {
        if (!this.authenticated) {
            throw AuthenticationError('Authentication is required');
        }
    }

    getOrganisationId(): string | null {
        return this.organisationId;
    }

    requireOrganisationId(): string {
        if (!this.organisationId) {
            throw AuthenticationError('OrganisationId is required');
        }
        return this.organisationId;
    }

    getJwt() {
        return this.jwt;
    }

    requireJwt(): AutomationCloudDecodedJwt {
        if (!this.jwt) {
            throw AuthenticationError('Jwt is required');
        }
        return this.jwt;
    }

    set(details: {
        authenticated: boolean;
        organisationId: string | null;
        jwt: AutomationCloudDecodedJwt | null;
    }) {
        Object.assign(this, details);
    }

}

function AuthenticationError(message: string, details?: any) {
    return new Exception({
        name: 'AuthenticationError',
        status: 401,
        message,
        details,
    });
}
