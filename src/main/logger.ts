import { ConsoleLogger, LOG_LEVELS, LogfmtLogger, Logger, LogLevel } from '@nodescript/logger';
import { config } from 'mesh-config';

import { getGlobalMetrics } from './metrics/global.js';

export {
    LOG_LEVELS,
    LogLevel,
    Logger,
    ConsoleLogger,
    LogfmtLogger,
};

export class StandardLogger extends Logger {

    @config({ default: 'info' })
    LOG_LEVEL!: string;
    @config({ default: false })
    LOG_PRETTY!: boolean;

    protected delegate: Logger;

    constructor() {
        super();
        this.delegate = this.LOG_PRETTY ? new ConsoleLogger() : new LogfmtLogger();
        this.delegate.setLevel(this.LOG_LEVEL);
        this.setLevel(this.LOG_LEVEL);
    }

    override write(level: LogLevel, message: string, data: object): void {
        getGlobalMetrics().appLogsTotal.incr(1, { severity: level });
        this.delegate.write(level, message, data);
    }

}
