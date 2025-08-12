import { AuthContext, AuthToken } from './auth-context.js';

export type AuthHeaders = Record<string, string | string[] | undefined>;

export abstract class AuthProvider<T extends AuthToken> {
    abstract provide(headers?: AuthHeaders): Promise<AuthContext<T | null>>;
}
