import fetch, { Response } from 'node-fetch';
import querystring from 'querystring';
import { injectable, inject } from 'inversify';
import { Exception } from './exception';
import { Logger } from './logger';

const NETWORK_ERRORS = [
    'EAI_AGAIN',
    'EHOSTDOWN',
    'EHOSTUNREACH',
    'ECONNABORTED',
    'ECONNREFUSED',
    'ECONNRESET',
    'EPIPE'
];

export interface RequestHeaders {
    [key: string]: string | null | undefined;
}

export interface RequestOptions {
    body?: any;
    query?: { [key: string]: any };
    headers?: RequestHeaders;
}

export interface RequestConfig {
    baseUrl: string;
    authKey?: string;
    retryAttempts?: number;
    retryDelay?: number;
    headers?: RequestHeaders;
}

@injectable()
export class RequestFactory {
    @inject(Logger)
    logger!: Logger;

    create(config: RequestConfig): Request {
        return new Request(this, config);
    }
}

export class Request {
    factory: RequestFactory;
    config: RequestConfig;

    constructor(factory: RequestFactory, config: RequestConfig) {
        this.factory = factory;
        this.config = config;
    }

    get logger(): Logger {
        return this.factory.logger;
    }

    async get(url: string, options: RequestOptions = {}): Promise<any> {
        return await this.sendJson('get', url, options);
    }

    async post(url: string, options: RequestOptions = {}): Promise<any> {
        return await this.sendJson('post', url, options);
    }

    async put(url: string, options: RequestOptions = {}): Promise<any> {
        return await this.sendJson('put', url, options);
    }

    async delete(url: string, options: RequestOptions = {}): Promise<any> {
        return await this.sendJson('delete', url, options);
    }

    async sendJson(method: string, url: string, options: RequestOptions = {}): Promise<any> {
        const res = await this.send(method, url, options);
        const { status } = res;
        if (status === 204) {
            // No response
            return null;
        }
        if (!res.ok) {
            throw await this.createErrorFromResponse(method, url, res);
        }
        const json = await res.json();
        return json;
    }

    async send(method: string, url: string, options: RequestOptions = {}): Promise<Response> {
        const { baseUrl, authKey } = this.config;
        // Prepare headers
        const authorization = authKey ? 'Basic ' + Buffer.from(authKey + ':').toString('base64') : undefined;
        const headers = this.mergeHeaders({ authorization }, this.config.headers || {}, options.headers || {});
        // Prepare body
        let body = options.body || null;
        if(body) {
            headers['Content-Type'] = 'application/json';
            body = JSON.stringify(body);
        }
        // Prepare URL
        const qs = querystring.stringify(options.query || {});
        const fullUrl = baseUrl + url + (qs ? '?' + qs : '');
        // Send request
        return await this.fetchWithRetry(fullUrl, { method, headers, body });
    }

    async fetchWithRetry(fullUrl: string, fetchOptions: any): Promise<Response> {
        const { retryAttempts = 20, retryDelay = 1000 } = this.config;
        let attempted = 0;
        let lastError = null;
        while (attempted < retryAttempts) {
            try {
                attempted += 1;
                return await fetch(fullUrl, fetchOptions);
            } catch (e) {
                if (NETWORK_ERRORS.includes(e.code)) {
                    lastError = e;
                    await new Promise(r => setTimeout(r, retryDelay));
                } else {
                    throw e;
                }
            }
        }
        throw lastError;
    }

    protected mergeHeaders(...headers: RequestHeaders[]) {
        const result: { [key: string]: string } = {};
        for (const hdrs of headers) {
            for (const [k, v] of Object.entries(hdrs)) {
                if (!v) {
                    continue;
                }
                result[k.toLowerCase()] = v;
            }
        }
        return result;
    }

    protected async createErrorFromResponse(
        method: string,
        url: string,
        res: Response,
    ): Promise<Error> {
        const responseText = await res.text();
        try {
            const json = JSON.parse(responseText);
            return new Exception({
                name: json.name,
                message: json.message,
                details: json.details,
                status: res.status,
            });
        } catch (err) {
            this.logger.warn(`Request failed: unable to parse response JSON`, {
                details: {
                    method,
                    url,
                    fullUrl: res.url,
                    status: res.status,
                    responseText,
                },
                error: {
                    name: err.name,
                    message: err.name
                }
            });
            return new Exception({
                name: 'InternalError',
                message: 'The request cannot be processed',
            });
        }
    }

}
