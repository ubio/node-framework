import Ajv, { ValidateFunction as AjvValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import escapeRegexp from 'escape-string-regexp';
import { inject, injectable } from 'inversify';
import * as koa from 'koa';

import { Config, config } from './config';
import { ClientError, Exception } from './exception';
import { Logger } from './logger';
import { getGlobalMetrics } from './metrics/global';
import { ajvErrorToMessage, AnyConstructor, Constructor, deepClone } from './util';

const ROUTES_KEY = Symbol('Route');
const PARAMS_KEY = Symbol('Param');

// Lightweight routing based on IoC and decorators.

const ajv = new Ajv({
    allErrors: true,
    coerceTypes: 'array',
    useDefaults: true,
    removeAdditional: true,
    keywords: ['optional'],
});
addFormats(ajv);

export function Get(spec: RouteSpec = {}) {
    return routeDecorator('get', spec);
}

export function Post(spec: RouteSpec = {}) {
    return routeDecorator('post', spec);
}

export function Put(spec: RouteSpec = {}) {
    return routeDecorator('put', spec);
}

export function Delete(spec: RouteSpec = {}) {
    return routeDecorator('delete', spec);
}

export function Middleware(spec: RouteSpec = {}) {
    return routeDecorator('*', spec, true);
}

export function PathParam(name: string, spec: ParamSpec) {
    return paramDecorator('path', name, spec);
}

export function QueryParam(name: string, spec: ParamSpec) {
    return paramDecorator('query', name, spec);
}

export function BodyParam(name: string, spec: ParamSpec) {
    return paramDecorator('body', name, spec);
}

function routeDecorator(method: string, spec: RouteSpec, isMiddleware: boolean = false) {
    return (target: any, methodKey: string) => {
        const {
            summary = '',
            deprecated = false,
            path = '',
            responses = {},
        } = spec;
        const params: ParamDefinition[] = Reflect.getMetadata(PARAMS_KEY, target, methodKey) || [];
        // const nonBodyParams = params.filter(_ => _.source !== 'body');
        const bodyParams = params.filter(_ => _.source === 'body');
        if (spec.requestBodySchema) {
            if (bodyParams.length > 0) {
                throw new Exception(
                    `${method} ${path}: BodyParams are only supported if requestBodySchema is not specified`);
            }
        }
        const requestBodySchema = spec.requestBodySchema ? ajv.compile(spec.requestBodySchema) :
            bodyParams.length > 0 ? compileParamsSchema(bodyParams) : undefined;
        const paramsSchema = compileParamsSchema(params);
        const route: RouteDefinition = {
            target,
            deprecated,
            methodKey,
            isMiddleware,
            summary,
            method,
            path,
            pathTokens: tokenizePath(path),
            params,
            paramsSchema,
            requestBodySchema,
            responses,
        };
        validateRouteDefinition(route);
        getGlobalRouteRegistry().push(route);
        const routes: RouteDefinition[] = Reflect.getMetadata(ROUTES_KEY, target) || [];
        routes.push(route);
        Reflect.defineMetadata(ROUTES_KEY, routes, target);
    };
}

export function paramDecorator(source: ParamSource, name: string, spec: ParamSpec) {
    return (target: any, methodKey: string, index: number) => {
        const params: ParamDefinition[] =
            Reflect.getMetadata(PARAMS_KEY, target, methodKey) || [];
        const {
            description = '',
            schema,
            required = true,
            deprecated = false,
        } = spec;
        params.push({
            index,
            source,
            name,
            description,
            schema,
            required,
            deprecated,
        });
        Reflect.defineMetadata(PARAMS_KEY, params, target, methodKey);
    };
}

export type RouterConstructor = new (...args: any[]) => Router;

@injectable()
export class Router {
    @inject(Logger)
    logger!: Logger;
    @inject('KoaContext')
    ctx!: koa.Context;
    @inject(Config)
    config!: Config;

    @config({ default: false }) HTTP_VALIDATE_RESPONSES!: boolean;

    params: Params = {};

    handle(): Promise<boolean> {
        return getGlobalMetrics().handlerDuration.measure(async () => {
            // Route matched; now validate parameters
            for (const route of getEndpointRoutes(this.constructor as Constructor<Router>)) {
                const pathParams = matchRoute(route, this.ctx.method, this.ctx.path);
                if (pathParams == null) {
                    continue;
                }
                // Route matched, now execute all middleware first, then execute the route itself
                for (const middleware of getMiddlewareRoutes(this.constructor as Constructor<Router>)) {
                    const pathParams = matchRoute(middleware, this.ctx.method, this.ctx.path);
                    if (pathParams == null) {
                        continue;
                    }
                    await this.executeRoute(middleware, pathParams);
                }
                const response = await this.executeRoute(route, pathParams);
                this.ctx.body = response ?? this.ctx.body ?? {};
                if (this.HTTP_VALIDATE_RESPONSES) {
                    this.validateResponseBody(route, this.ctx.status, this.ctx.body);
                }
                return true;
            }
            // No routes match
            return false;
        }, { method: this.ctx.method, path: this.ctx.path, protocol: this.ctx.protocol });
    }

    protected async executeRoute(ep: RouteDefinition, pathParams: Params): Promise<any> {
        const paramsObject = this.assembleParams(ep, pathParams);
        this.validateRequestParams(ep, paramsObject);
        this.validateRequestBody(ep, this.ctx.request.body);
        // Bind params to router instance, so that the route can use them
        this.params = paramsObject;
        // Retrieve the parameters by name, because validator will apply coercion and defaults
        const paramsArray: any[] = new Array(ep.params.length);
        for (const p of ep.params) {
            paramsArray[p.index] = paramsObject[p.name];
        }
        return await (this as any)[ep.methodKey](...paramsArray);
    }

    protected validateRequestParams(ep: RouteDefinition, paramsObject: { [key: string]: any }) {
        const valid = ep.paramsSchema(paramsObject);
        if (!valid) {
            const messages = ep.paramsSchema.errors!.map(e => ajvErrorToMessage(e));
            throw new RequestParametersValidationError(messages);
        }
    }

    protected validateRequestBody(ep: RouteDefinition, body: any) {
        if (!ep.requestBodySchema) {
            return;
        }
        const valid = ep.requestBodySchema(body);
        if (!valid) {
            const messages = ep.requestBodySchema.errors!.map(e => ajvErrorToMessage(e));
            throw new RequestParametersValidationError(messages);
        }
    }

    protected validateResponseBody(ep: RouteDefinition, statusCode: number, body: unknown) {
        // Only validate JSON bodies
        if (body == null || typeof body !== 'object') {
            return;
        }
        const responseSchema = ep.responses[statusCode]?.schema;
        if (!responseSchema) {
            // Note: we bypass this for now; in future we might want to cover standard error responses too
            return;
        }
        const validator = ajv.compile(responseSchema);
        const valid = validator(body);
        if (!valid) {
            const messages = validator.errors!.map(e => ajvErrorToMessage(e));
            throw new ResponseValidationError(messages);
        }
    }

    protected assembleParams(ep: RouteDefinition, pathParams: Params): { [key: string]: any } {
        const body: any = deepClone(this.ctx.request.body || {});
        const query: any = deepClone(this.ctx.request.query || {});
        // First assemble the parameters into an object and validate them
        const paramsObject: any = {};
        for (const p of ep.params) {
            switch (p.source) {
                case 'path':
                    paramsObject[p.name] = pathParams[p.name];
                    break;
                case 'query':
                    paramsObject[p.name] = query[p.name];
                    break;
                case 'body':
                    paramsObject[p.name] = body[p.name];
                    break;
            }
        }
        return paramsObject;
    }

}

function validateRouteDefinition(ep: RouteDefinition) {
    // TODO we can also validate all JSON schema against metaschema here
    const paramNamesSet: Set<string> = new Set();
    for (const param of ep.params) {
        if (paramNamesSet.has(param.name)) {
            throw new Exception(
                `${ep.method} ${ep.path}: Parameter ${param.name} is declared more than once`
            );
        }
        paramNamesSet.add(param.name);
    }
}

export function matchRoute(
    ep: RouteDefinition,
    method: string,
    path: string
): Params | null {
    if (ep.method !== '*' && ep.method.toLowerCase() !== method.toLowerCase()) {
        return null;
    }
    return matchPath(path, ep.pathTokens, ep.isMiddleware);
}

function compileParamsSchema(params: ParamDefinition[] = []): AjvValidateFunction {
    const properties: any = {};
    const required: string[] = [];
    for (const p of params) {
        properties[p.name] = p.schema;
        if (p.required) {
            required.push(p.name);
        }
    }
    return ajv.compile({
        type: 'object',
        properties,
        required,
        additionalProperties: false, // now required, because of removeAdditional: true
    });
}

/**
 * Parses /foo/{fooId}/bar/{barId} to extract static and parameter tokens.
 */
export function tokenizePath(path: string): PathToken[] {
    const tokens: PathToken[] = [];
    const re = /\{(.*?)\}/ig;
    let idx = 0;
    let m = re.exec(path);
    while (m != null) {
        const prefix = path.substring(idx, m.index);
        if (prefix) {
            tokens.push({ type: 'string', value: prefix });
        }
        idx = m.index + m[0].length;
        const [, asterisk, value] = /^(\*)?(.*)/.exec(m[1])!;
        const wildcard = !!asterisk;
        tokens.push({ type: 'param', value, wildcard });
        m = re.exec(path);
    }
    const suffix = path.substring(idx);
    if (suffix) {
        tokens.push({ type: 'string', value: suffix });
    }
    return tokens;
}

/**
 * Matches `path` against a list of path tokens, obtained from `tokenizePath`.
 * If `matchStart` is true, allows path to have prefix which does not match the tokens.
 */
export function matchPath(
    path: string,
    tokens: PathToken[],
    matchStart: boolean = false
): Params | null {
    const params: Params = {};
    const regex = tokens
        .map(tok => pathTokenToRegexp(tok))
        .join('');
    const lastTokenValue = tokens[tokens.length - 1]?.value || '';
    const routerPathTrailingSlash = lastTokenValue[lastTokenValue.length - 1] === '/';
    const startWith = routerPathTrailingSlash ? '.' : '[/]';
    const re = new RegExp('^' + regex + (matchStart ? `(?=$|${startWith})` : '/?$'));
    const m = re.exec(path);
    if (m == null) {
        return null;
    }
    const paramNames = tokens.filter(_ => _.type === 'param').map(_ => _.value);
    for (const [i, name] of paramNames.entries()) {
        params[name] = m[i + 1];
    }
    return params;
}

function pathTokenToRegexp(token: PathToken) {
    if (token.type === 'string') {
        return escapeRegexp(token.value);
    }
    return token.wildcard ? '(.+?)' : '([^/]+?)';
}

// Helpers for accessing metadata and generating docs

export function getGlobalRouteRegistry(): RouteDefinition[] {
    let registry: RouteDefinition[] = (global as any)[ROUTES_KEY];
    if (!registry) {
        registry = [];
        (global as any)[ROUTES_KEY] = registry;
    }
    return registry;
}

export function getAllRoutes(routerClass: AnyConstructor): RouteDefinition[] {
    return Reflect.getMetadata(ROUTES_KEY, routerClass.prototype) || [];
}

export function getMiddlewareRoutes(routerClass: AnyConstructor) {
    return getAllRoutes(routerClass).filter(ep => ep.isMiddleware);
}

export function getEndpointRoutes(routerClass: AnyConstructor) {
    return getAllRoutes(routerClass).filter(ep => !ep.isMiddleware);
}

// Type definitions

export interface Params {
    [key: string]: any;
}

export interface PathToken {
    type: 'string' | 'param';
    value: string;
    wildcard?: boolean;
}

export type ParamSource = 'path' | 'query' | 'body';

export interface RouteDefinition {
    target: any;
    methodKey: string;

    summary: string;
    deprecated: boolean;
    isMiddleware: boolean;
    method: string;
    path: string;
    pathTokens: PathToken[];
    params: ParamDefinition[];
    paramsSchema: AjvValidateFunction;
    requestBodySchema?: AjvValidateFunction;
    responses: ResponsesSpec;
}

export interface ParamDefinition {
    index: number;
    name: string;
    source: ParamSource;
    schema: object;
    description: string;
    required: boolean;
    deprecated: boolean;
}

export interface RouteSpec {
    summary?: string;
    deprecated?: boolean;
    path?: string;
    requestBodySchema?: object;
    responses?: ResponsesSpec;
}

export interface ParamSpec {
    schema: object;
    description?: string;
    required?: boolean;
    deprecated?: boolean;
}

export interface ResponsesSpec {
    [status: number]: ResponseSpec;
}

export interface ResponseSpec {
    description?: string;
    schema?: object;
    contentType?: string | string[];
}

export class RequestParametersValidationError extends ClientError {
    status = 400;

    constructor(messages: string[]) {
        super(`Invalid request parameters:\n${messages.map(_ => `    - ${_}`).join('\n')}`);
        this.details = { messages };
    }
}

export class ResponseValidationError extends ClientError {
    status = 500;

    constructor(messages: string[]) {
        super(`Response body is not valid:\n${messages.map(_ => `    - ${_}`).join('\n')}`);
        this.details = { messages };
    }
}
