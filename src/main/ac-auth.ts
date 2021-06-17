import { ClientError } from './exception';

export interface AcAuthSpec {
    authenticated: boolean;
    organisationId?: string;
    serviceAccountId?: string;
    serviceAccountName?: string;
    userId?: string;
    userName?: string;
    clientId?: string;
    clientName?: string;
    endUserId?: string;
}

type Role = 'ServiceAccount' | 'User' | 'Client' | 'EndUser';
interface Actor {
    role: Role;
    id: string;
    name?: string;
}


export class AcAuth implements AcAuthSpec{
    authenticated: boolean = false;
    organisationId?: string;
    serviceAccountId?: string;
    serviceAccountName?: string;
    userId?: string;
    userName?: string;
    clientId?: string;
    clientName?: string;
    endUserId?: string;

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
        return this.organisationId ?? null;
    }

    requireOrganisationId(): string {
        if (!this.organisationId) {
            throw new AccessForbidden('organisationId is required');
        }
        return this.organisationId;
    }

    /**
     * @deprecated use serviceAccountId instead, or use getActor()
     */
    getServiceAccountId(): string | null {
        return this.serviceAccountId ?? null;
    }

    /**
     * @deprecated use getActor()
     */
    requireServiceAccountId(): string {
        if (!this.serviceAccountId) {
            throw new AccessForbidden('serviceAccountId is required');
        }
        return this.serviceAccountId;
    }

    requireActor(roles: Role[] = ['ServiceAccount', 'User', 'Client', 'EndUser']) {
        const actor = this.getActor();
        if (!actor || !roles.includes(actor.role)) {
            throw new AccessForbidden('Insufficient peremission');
        }

        return actor;
    }

    getActor(): Actor | null {
        if (this.serviceAccountId) {
            return {
                role: 'ServiceAccount',
                id: this.serviceAccountId,
                name: this.serviceAccountName,
            }
        }

        if (this.userId) {
            return {
                role: 'User',
                id: this.userId,
                name: this.userName,
            };
        }

        if (this.clientId) {
            return {
                role: 'Client',
                id: this.clientId,
                name: this.clientName,
            }
        }

        if (this.endUserId) {
            return {
                role: 'EndUser',
                id: this.endUserId,
            };
        }

        return null;
    }

    getRole(): Role | null {
        return this.getActor()?.role ?? null
    }
}

export class AuthenticationError extends ClientError {
    status = 401;
    message = 'Authentication is required';
}

export class AccessForbidden extends ClientError {
    status = 403;
}
