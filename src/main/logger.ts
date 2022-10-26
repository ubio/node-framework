import { ConsoleLogger, LOG_LEVELS, LogfmtLogger, Logger, LogLevel } from '@flexent/logger';
import { inject, injectable } from 'inversify';
import * as koa from 'koa';

import { Config, config } from './config.js';


export {
    LOG_LEVELS,
    LogLevel,
    Logger,
    ConsoleLogger,
    LogfmtLogger,
};

@injectable()
export class StandardLogger extends Logger {

    @config({ default: 'info' })
    LOG_LEVEL!: string;
    @config({ default: false })
    LOG_PRETTY!: boolean;

    protected delegate: Logger;

    constructor(
        @inject(Config)
        readonly config: Config,
    ) {
        super();
        this.delegate = this.LOG_PRETTY ? new ConsoleLogger() : new LogfmtLogger();
        this.delegate.setLevel(this.LOG_LEVEL);
        this.setLevel(this.LOG_LEVEL);
    }

    override write(level: LogLevel, message: string, data: object): void {
        this.delegate.log(level, message, data);
    }

}

export class RequestLogger extends Logger {

    constructor(
        protected delegate: Logger,
        protected ctx: koa.Context,
    ) {
        super();
        this.setLevel(delegate.level);
    }

    write(level: LogLevel, message: string, data: object): void {
        const { requestId } = this.ctx.state;
        this.delegate.log(level, message, {
            ...data,
            requestId,
        });
    }

}
