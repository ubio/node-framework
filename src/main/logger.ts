import { injectable, inject } from 'inversify';
import * as koa from 'koa';
import { LogLevel, StandardLogger } from '@ubio/essentials';

@injectable()
export class RequestLogger extends StandardLogger {
    @inject('KoaContext')
    ctx!: koa.Context;

    log(level: LogLevel, message: string, data: object = {}) {
        const { requestId } = this.ctx.state;
        super.log(level, message, {
            ...data,
            requestId,
        });
    }

}
