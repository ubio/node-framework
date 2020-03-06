import { injectable, inject } from 'inversify';
import chalk, { Chalk} from 'chalk';
import * as koa from 'koa';

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

    protected abstract write(level: LogLevel, message: string, details: object): void;
    abstract child(data: object): Logger;

    log(level: LogLevel, message: string, details: object) {
        if (level === 'mute' || LOG_LEVELS.indexOf(level) < LOG_LEVELS.indexOf(this.level)) {
            return;
        }
        return this.write(level, message, details);
    }

    info(message: string, details: object = {}) {
        this.log('info', message, details);
    }

    warn(message: string, details: object = {}) {
        this.log('warn', message, details);
    }

    error(message: string, details: object = {}) {
        this.log('error', message, details);
    }

    debug(message: string, details: object = {}) {
        this.log('debug', message, details);
    }

    metric(message: string, details: any = {}): void {
        this.log('info', message, { isMetric: true, ...details });
    }

    addContextData(data: object): this {
        this.contextData = { ...this.contextData, ...data };
        return this;
    }

}

@injectable()
export class ConsoleLogger extends Logger {

    protected write(level: LogLevel, message: string, details: object): void {
        if (level === 'info' || level === 'debug' || level === 'warn' || level === 'error') {
            console[level](message, { ...this.contextData, ...details });
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

    protected write(level: LogLevel, message: string, details: object) {
        if (this.pretty) {
            this.logPretty(level, message, details);
        } else {
            this.logStructured(level, message, details);
        }
    }

    protected logStructured(level: LogLevel, message: string, details: object) {
        const [seconds, nanos] = process.hrtime();
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
        process.stdout.write(JSON.stringify(payload, jsonReplacer) + '\n');
    }

    protected logPretty(level: LogLevel, message: string, details: object) {
        const color = LEVELS_COLOR[level] || chalk;
        let ts = new Date().toISOString().replace('T', ' ').replace('Z', '');
        if (level === 'debug') {
            ts = chalk.gray(ts);
        }
        const detailsStr = chalk.gray(JSON.stringify(details, jsonReplacer, 2));
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

// Helper to deserialize error fields to JSON
function jsonReplacer(k: string, v: any) {
    if (v instanceof Error) {
        return {
            name: v.name,
            message: v.message,
            code: (v as any).code,
            details: (v as any).details,
            status: (v as any).status,
        };
    }
    return v;
}
