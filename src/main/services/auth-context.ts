import { ClientError } from '@nodescript/errors';

export type AuthToken = object;

export class AuthContext<T extends AuthToken | null> {

    constructor(private authToken: T) {}

    isAuthenticated() {
        return this.authToken != null;
    }

    checkAuthenticated(): void {
        if (!this.isAuthenticated()) {
            throw new AuthenticationError();
        }
    }

    getAuthToken(): T {
        return this.authToken;
    }

    setAuthToken(authToken: T): void {
        this.authToken = authToken;
    }
}


export class AuthenticationError extends ClientError {
    override status = 401;
    override message = 'Authentication is required';
}
