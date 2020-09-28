import { injectable } from 'inversify';
import * as Koa from 'koa';

@injectable()
export abstract class CustomMiddleware {
    abstract async apply(ctx: Koa.Context): Promise<void>;
}
