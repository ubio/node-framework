import { ConsoleLogger, DefaultLogFormatter, LOG_LEVELS, LogfmtFormatter, Logger, LogLevel, LogPayload, StructuredLogFormatter } from '@nodescript/logger';
import { config } from 'mesh-config';

import { getGlobalMetrics } from './metrics/global.js';

export {
    LOG_LEVELS,
    LogLevel,
    Logger,
    ConsoleLogger,
};

export class StandardLogger extends ConsoleLogger {

    @config({ default: 'info' })
    LOG_LEVEL!: string;
    @config({ default: false })
    LOG_PRETTY!: boolean;
    @config({ default: false })
    LOG_LOGFMT!: boolean;

    constructor() {
        super();
        this.formatter = this.LOG_PRETTY ? new DefaultLogFormatter() :
            this.LOG_LOGFMT ? new LogfmtFormatter() : new StructuredLogFormatter();
        this.setLevel(this.LOG_LEVEL);
    }

    override write(payload: LogPayload) {
        getGlobalMetrics().appLogsTotal.incr(1, { severity: payload.level });
        super.write(payload);
    }

}
