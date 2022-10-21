import { ConsoleLogger, LOG_LEVELS, LogfmtLogger, Logger, LogLevel } from '@flexent/logger';
import chalk, { Chalk } from 'chalk';
import { inject, injectable } from 'inversify';
import * as koa from 'koa';

import { getGlobalMetrics } from './metrics/global.js';
import { safeStringify } from './stringify.js';

export {
    LOG_LEVELS,
    LogLevel,
    Logger,
    ConsoleLogger,
    LogfmtLogger,
};

const LEVELS_COLOR: { [key: string]: Chalk } = {
    mute: chalk.grey.bind(chalk),
    debug: chalk.grey.bind(chalk),
    info: chalk.cyan.bind(chalk),
    warn: chalk.yellow.bind(chalk),
    error: chalk.red.bind(chalk)
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
export class StandardLogger extends BaseLogger {
    pretty: boolean = false;

    constructor() {
        super();
        this.level = (process.env.LOG_LEVEL || 'info') as LogLevel;
        if (!Object.values(LOG_LEVELS).includes(this.level)) {
            this.level = LogLevel.INFO;
        }
        this.pretty = process.env.LOG_PRETTY === 'true';
    }

    write(level: LogLevel, message: string, data: object) {
        if (this.pretty) {
            this.logPretty(level, message, data);
        } else {
            this.logStructured(level, message, data);
        }
    }

    protected logStructured(level: LogLevel, message: string, details: object) {
        const [_seconds, nanos] = process.hrtime();
        // Note: this format seems to not be supported for the time being
        // const timestamp = { seconds, nanos };
        const timestamp = new Date().toISOString().split('.')[0] + nanos + 'Z';
        const payload = {
            message,
            severity: (level === 'warn' ? 'warning' : level).toUpperCase(),
            timestamp,
            ...this.contextData,
            ...details
        };
        process.stdout.write(safeStringify(payload) + '\n');
    }

    protected logPretty(level: LogLevel, message: string, details: object) {
        const color = LEVELS_COLOR[level] || chalk;
        let ts = new Date().toISOString().replace('T', ' ').replace('Z', '');
        if (level === 'debug') {
            ts = chalk.gray(ts);
        }
        const detailsStr = chalk.gray(safeStringify(details, { indent: 2 }));
        process.stdout.write(`${ts} ${color(message)} ${detailsStr}\n`);
    }

    child(data: object): Logger {
        const logger = new StandardLogger();
        logger.contextData = { ...this.contextData, ...data };
        return logger;
    }

}

@injectable()
export class RequestLogger extends StandardLogger {
    @inject('KoaContext')
    ctx!: koa.Context;

    override log(level: LogLevel, message: string, data: object = {}) {
        const { requestId } = this.ctx.state;
        super.log(level, message, {
            ...data,
            requestId,
        });
    }
}
