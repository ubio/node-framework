import { Container, injectable } from 'inversify';
import * as Koa from 'koa';
import { RequestAuthService } from './services';

@injectable()
export abstract class CustomMiddleware {
    abstract async apply(ctx: Koa.Context): Promise<void>;
}

@injectable()
export class AuthMiddleware extends CustomMiddleware {
    async apply(ctx: Koa.Context): Promise<void> {
        const container = ctx.container as Container;
        const authService = container.get(RequestAuthService);
        await authService.check(ctx);
    }
}
