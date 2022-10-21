import { ConsoleLogger, LOG_LEVELS, LogfmtLogger, Logger, LogLevel } from '@flexent/logger';
import { inject, injectable } from 'inversify';
import * as koa from 'koa';

import { getGlobalMetrics } from './metrics/global.js';

export {
    LOG_LEVELS,
    LogLevel,
    Logger,
    ConsoleLogger,
    LogfmtLogger,
};

@injectable()
export abstract class BaseLogger extends Logger {
    contextData: object = {};

    abstract child(data: object): Logger;

    override log(level: LogLevel, message: string, data: object) {
        super.log(level, message, data);
        getGlobalMetrics().appLogsTotal.incr(1, { severity: level });
    }

    addContextData(data: object): this {
        this.contextData = { ...this.contextData, ...data };
        return this;
    }

}

@injectable()
export class RequestLogger extends Logger {
    @inject('KoaContext')
    ctx!: koa.Context;

    @inject(Logger)
    protected logger!: Logger;

    write(level: LogLevel, message: string, data: object): void {
        const { requestId } = this.ctx.state;
        this.logger.write(level, message, {
            ...data,
            requestId,
        });
    }

}
