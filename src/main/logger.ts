import { injectable, inject } from 'inversify';
import * as koa from 'koa';
import { Logger, LogLevel } from '@ubio/essentials';

export {
    Logger
};

@injectable()
export class RequestLogger extends Logger {
    @inject('KoaContext')
    ctx!: koa.Context;

    protected log(level: LogLevel, message: string, data: object = {}) {
        const { requestId } = this.ctx.state;
        super.log(level, message, {
            ...data,
            requestId,
        });
    }

}
