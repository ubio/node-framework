import fetch from 'node-fetch';
import querystring from 'querystring';
import { util } from '.';

const NETWORK_ERRORS = [
    'EAI_AGAIN',
    'EHOSTDOWN',
    'EHOSTUNREACH',
    'ECONNABORTED',
    'ECONNREFUSED',
    'ECONNRESET',
    'EPIPE'
];

export interface RequestOptions {
    url: string;
    method?: string;
    body?: any;
    query?: { [key: string]: any };
    headers?: { [key: string]: string };
}

export interface RequestConfig {
    baseUrl: string;
    authKey: string;
    retryAttempts?: number;
    retryDelay?: number;
    headers?: { [key: string]: string };
}

export type RequestFunction = (options: RequestOptions) => Promise<any>;

export function createRequest(config: RequestConfig): RequestFunction {
    const { baseUrl, authKey, retryAttempts = 20, retryDelay = 1000 } = config;
    const authHeader = 'Basic ' + Buffer.from(authKey + ':').toString('base64');

    return async function request(options: RequestOptions): Promise<any> {
        const {
            url,
            method = 'GET',
            query = {},
        } = options;

        const headers: { [key: string]: string } = {
            Authorization: authHeader,
            ...config.headers,
            ...options.headers
        };

        let body = options.body || null;

        if (body) {
            headers['Content-Type'] = 'application/json';
            body = JSON.stringify(body);
        }

        const qs = querystring.stringify(query);
        const fullUrl = baseUrl + url + (qs ? '?' + qs : '');
        const res = await fetchWithRetry(fullUrl, {
            method,
            body,
            headers
        });
        const { status } = res;
        if (status === 204) {
            // No response
            return null;
        }
        if (!res.ok) {
            const text = await res.text();
            throw createErrorFromResponse(status, text);
        }
        const json = await res.json();
        return json;
    };

    async function fetchWithRetry(fullUrl: string, fetchOptions: any): Promise<any> {
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

    function createErrorFromResponse(status: number, responseText: string): Error {
        try {
            const json = JSON.parse(responseText);
            return util.createError({
                name: json.name,
                message: json.message,
                details: json.details,
                status
            });
        } catch (err) {
            return util.createError({
                name: 'RequestFailedError',
                message: `Could not parse JSON response: ${err.message}`,
                status
            });
        }
    }

}
