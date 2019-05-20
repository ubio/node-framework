import { injectable, inject } from 'inversify';
import * as koa from 'koa';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'mute';

const LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error', 'mute'];

@injectable()
export class Logger {
    level: LogLevel;
    contextData: object = {};
    ubioLogger: any;

    constructor() {
        this.level = (process.env.LOG_LEVEL || 'info') as LogLevel;
        if (!LEVELS.includes(this.level)) {
            this.level = 'info';
        }
    }

    protected log(level: LogLevel, message: string, details: object) {
        if (level === 'mute' || LEVELS.indexOf(level) < LEVELS.indexOf(this.level)) {
            return;
        }
        const [seconds, nanos] = process.hrtime();
        // Note: this format seems to not be supported for the time being
        // const timestamp = { seconds, nanos };
        const timestamp = new Date().toISOString().split('.')[0] + nanos + 'Z';
        const payload = {
            message,
            severity: level === 'warn' ? 'warning' : level,
            // timestamp,
            timestamp,
            ...this.contextData,
            ...details
        };
        process.stdout.write(JSON.stringify(payload, jsonReplacer) + '\n');
        // this.ubioLogger[level](message, { ...this.contextData, ...data });
    }

    metric(message: string, details: any = {}): void {
        this.log('info', message, { isMetric: true, ...details });
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

    addContextData(data: object): this {
        this.contextData = { ...this.contextData, ...data };
        return this;
    }

}

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

// Helper to deserialize error fields to JSON
function jsonReplacer(k: string, v: any) {
    if (v instanceof Error) {
        return {
            name: v.name,
            message: v.message,
            code: (v as any).code,
            details: (v as any).details,
        };
    }
    return v;
}
