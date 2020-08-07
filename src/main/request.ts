import { injectable, inject } from 'inversify';
import { Logger } from './logger';
import {
    Request as AcRequest,
    RequestConfig,
} from '@automationcloud/request';
export * from '@automationcloud/request';

@injectable()
export class RequestFactory {
    @inject(Logger)
    logger!: Logger;

    /**
     *
     * @param config
     * config.authKey is deprecated, use config.auth instead
     *
     * @example
     * const auth = new BasicAuthAgent({ username: authKey });
     * requestFactory.create({ baseUrl, auth });
     */
    create(config: Partial<RequestConfig>): Request {
        return new Request(this, config);
    }
}

export class Request extends AcRequest {
    factory: RequestFactory;

    constructor(factory: RequestFactory, config: Partial<RequestConfig>) {
        super(config);
        this.factory = factory;
    }

    get logger(): Logger {
        return this.factory.logger;
    }

}
