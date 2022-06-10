import chalk, { Chalk } from 'chalk';
import { inject, injectable } from 'inversify';
import * as koa from 'koa';

import { safeStringify } from './stringify';

import { getGlobalMetrics } from './metrics/global';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'mute';

export const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error', 'mute'];
const LEVELS_COLOR: { [key: string]: Chalk } = {
    mute: chalk.grey.bind(chalk),
    debug: chalk.grey.bind(chalk),
    info: chalk.cyan.bind(chalk),
    warn: chalk.yellow.bind(chalk),
    error: chalk.red.bind(chalk)
};

export interface ILogger {
    info(message: string, details?: any): void;
    warn(message: string, details?: any): void;
    error(message: string, details?: any): void;
    debug(message: string, details?: any): void;
    child(context: any): ILogger;
}

@injectable()
export abstract class Logger implements ILogger {
    contextData: object = {};
    level: LogLevel = 'info';

    protected abstract write(level: LogLevel, message: string, data: object): void;
    abstract child(data: object): Logger;

    log(level: LogLevel, message: string, data: object) {
        if (level === 'mute' || LOG_LEVELS.indexOf(level) < LOG_LEVELS.indexOf(this.level)) {
            return;
        }

        getGlobalMetrics().appLogsTotal.incr(1, { severity: level });

        return this.write(level, message, data);
    }

    info(message: string, data: object = {}) {
        this.log('info', message, data);
    }

    warn(message: string, data: object = {}) {
        this.log('warn', message, data);
    }

    error(message: string, data: object = {}) {
        this.log('error', message, data);
    }

    debug(message: string, data: object = {}) {
        this.log('debug', message, data);
    }

    addContextData(data: object): this {
        this.contextData = { ...this.contextData, ...data };
        return this;
    }

}

@injectable()
export class ConsoleLogger extends Logger {

    protected write(level: LogLevel, message: string, data: object): void {
        if (level === 'info' || level === 'debug' || level === 'warn' || level === 'error') {
            // eslint-disable-next-line no-console
            console[level](message, { ...this.contextData, ...data });
        }
    }

    child(data: object): Logger {
        const child = new ConsoleLogger();
        child.level = this.level;
        child.contextData = { ...this.contextData, ...data };
        return child;
    }

}

@injectable()
export class StandardLogger extends Logger {
    pretty: boolean = false;

    constructor() {
        super();
        this.level = (process.env.LOG_LEVEL || 'info') as LogLevel;
        this.pretty = process.env.LOG_PRETTY === 'true';
        if (!LOG_LEVELS.includes(this.level)) {
            this.level = 'info';
        }
    }

    protected write(level: LogLevel, message: string, data: object) {
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

    log(level: LogLevel, message: string, data: object = {}) {
        const { requestId } = this.ctx.state;
        super.log(level, message, {
            ...data,
            requestId,
        });
    }
}
