import { injectable, inject } from 'inversify';
import * as koa from 'koa';
import createUbioLogger from '@ubio/logger';

export type LogLevel = 'metric' | 'error' | 'warn' | 'info' | 'debug';

@injectable()
export class Logger {
    contextData: object = {};
    ubioLogger: any;

    constructor() {
        const pkg = require(process.cwd() + '/package.json');
        this.ubioLogger = createUbioLogger({
            severity: process.env.LOG_LEVEL || 'info',
            mode: process.env.LOG_PRETTY === 'true' ? 'pretty' : 'production',
            service: pkg.name,
            version: pkg.version,
        });
    }

    protected log(level: LogLevel, message: string, details: object) {
        const data = this.convertDetails(details);
        this.ubioLogger[level](message, { ...this.contextData, ...data });
    }

    metric(message: string, details: any = {}): void {
        this.log('metric', message, details);
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

    convertDetails(details: any) {
        // TODO consider converting error objects recursively
        return details instanceof Error ? {
            error: {
                name: details.name,
                code: (details as any).code,
                message: details.message,
                stack: details.stack,
                details: (details as any).details
            }
        } : details;
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
