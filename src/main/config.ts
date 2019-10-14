import { Configuration, Logger } from '@ubio/essentials';
import { injectable, inject } from 'inversify';
import dotenv from 'dotenv';

dotenv.config();

@injectable()
export class EnvConfiguration extends Configuration {
    logger: Logger;

    constructor(
        @inject(Logger)
        logger: Logger
    ) {
        super();
        this.logger = logger;
        this.setAll(process.env);
        const missing = this.getMissingConfigs();
        if (missing.length > 0) {
            const keys = missing.map(_ => _.key);
            this.logger.warn('Missing configuration keys', { keys });
        }
    }

}
