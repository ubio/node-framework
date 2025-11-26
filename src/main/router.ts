import { Logger } from '@nodescript/logger';
import { matchTokens, parsePath, PathToken } from '@nodescript/pathmatcher';
import Ajv, { ValidateFunction as AjvValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import * as koa from 'koa';
import { config } from 'mesh-config';
import { dep } from 'mesh-ioc';

import { ClientError, Exception } from './exception.js';
import { GlobalMetrics } from './metrics/global.js';
import { ajvErrorToMessage, AnyConstructor, Constructor, deepClone } from './util.js';

const ROUTES_KEY = Symbol('Route');
const PARAMS_KEY = Symbol('Param');

// Lightweight routing based on IoC and decorators.

const ajv = new Ajv.default({
    allErrors: true,
    coerceTypes: 'array',
    useDefaults: true,
    removeAdditional: true,
    keywords: ['optional'],
});
addFormats.default(ajv);

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

export function All(spec: RouteSpec = {}) {
    return routeDecorator('*', spec);
}

export function Middleware(spec: RouteSpec = {}) {
    return routeDecorator('*', spec, RouteRole.MIDDLEWARE);
}

export function AfterHook(spec: RouteSpec = {}) {
    return routeDecorator('*', spec, RouteRole.AFTER_HOOK);
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

function routeDecorator(method: string, spec: RouteSpec, role = RouteRole.ENDPOINT) {
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
            isMiddleware: role === RouteRole.MIDDLEWARE,
            role,
            summary,
            method,
            path,
            pathTokens: parsePath(path),
            ignorePathsTokens: spec.ignorePaths ? spec.ignorePaths.map(parsePath) : [],
            params,
            paramsSchema,
            requestBodySchema,
            responses,
            handleError: spec.handleError ?? false,
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

export class Router {

    @dep() protected logger!: Logger;
    @dep({ key: 'KoaContext' }) protected ctx!: koa.Context;
    @dep() protected globalMetrics!: GlobalMetrics;

    @config({ default: false }) HTTP_VALIDATE_RESPONSES!: boolean;

    params: Params = {};
    error: any;

    async handle(): Promise<boolean> {
        // Route matched; now validate parameters
        for (const route of getEndpointRoutes(this.constructor as Constructor<Router>)) {
            const pathParams = matchRoute(route, this.ctx.method, this.ctx.path);
            if (pathParams == null) {
                continue;
            }
            const routes = [
                ...getMiddlewareRoutes(this.constructor as Constructor<Router>),
                route,
                ...getAfterHookRoutes(this.constructor as Constructor<Router>),
            ];
            await this.globalMetrics.handlerDuration.measure(async () => {
                // Route matched, now execute all middleware first, then execute the route itself
                const response = await this.handleRoutes(routes);
                this.ctx.body = response ?? this.ctx.body ?? {};
                if (this.HTTP_VALIDATE_RESPONSES) {
                    this.validateResponseBody(route, this.ctx.status, this.ctx.body);
                }
            }, { method: route.method, path: route.path, protocol: this.ctx.protocol });
            return true;
        }
        // No routes match
        return false;
    }

    protected async handleRoutes(routes: RouteDefinition[]) {
        let response: any;
        for (const route of routes) {
            if (this.error && !route.handleError) {
                continue;
            }
            const pathParams = matchRoute(route, this.ctx.method, this.ctx.path);
            if (pathParams == null || ignoreRoute(route, this.ctx.path)) {
                continue;
            }
            try {
                const newResponse = await this.executeRoute(route, pathParams);
                response = newResponse ?? response;
            } catch (error) {
                this.error = error;
            }
        }
        if (this.error) {
            throw this.error;
        }
        return response;
    }

    protected async executeRoute(ep: RouteDefinition, pathParams: Params): Promise<any> {
        const paramsObject = this.assembleParams(ep, pathParams);
        this.validateRequestParams(ep, paramsObject);
        this.validateRequestBody(ep, this.ctx.request.body);
        // Bind params to router instance, so that the route can use them
        this.params = { ...this.params, ...paramsObject };
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
    const isNotEndpoint = ep.role !== RouteRole.ENDPOINT;
    return matchTokens(ep.pathTokens, path, isNotEndpoint);
}

export function ignoreRoute(
    ep: RouteDefinition,
    path: string
): boolean {
    if (ep.ignorePathsTokens.length === 0) {
        return false;
    }
    return ep.ignorePathsTokens.some(tokens => matchTokens(tokens, path, true) != null);
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
    return getAllRoutes(routerClass).filter(ep => ep.role === RouteRole.MIDDLEWARE);
}

export function getAfterHookRoutes(routerClass: AnyConstructor) {
    return getAllRoutes(routerClass).filter(ep => ep.role === RouteRole.AFTER_HOOK);
}

export function getEndpointRoutes(routerClass: AnyConstructor) {
    return getAllRoutes(routerClass).filter(ep => ep.role === RouteRole.ENDPOINT);
}

// Type definitions

export interface Params {
    [key: string]: any;
}

export type ParamSource = 'path' | 'query' | 'body';

export enum RouteRole {
    ENDPOINT = 'endpoint',
    MIDDLEWARE = 'middleware',
    AFTER_HOOK = 'after-hook',
}

export type AdjacentRouteRole = RouteRole.MIDDLEWARE | RouteRole.AFTER_HOOK;

export interface RouteDefinition {
    target: any;
    methodKey: string;

    summary: string;
    deprecated: boolean;
    isMiddleware: boolean;
    role: RouteRole;
    method: string;
    path: string;
    pathTokens: PathToken[];
    ignorePathsTokens: PathToken[][];
    params: ParamDefinition[];
    paramsSchema: AjvValidateFunction;
    requestBodySchema?: AjvValidateFunction;
    responses: ResponsesSpec;
    handleError: boolean;
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
    ignorePaths?: string[];
    requestBodySchema?: object;
    responses?: ResponsesSpec;
    handleError?: boolean;
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
    override status = 400;

    constructor(messages: string[]) {
        super(`Invalid request parameters:\n${messages.map(_ => `    - ${_}`).join('\n')}`);
        this.details = { messages };
    }
}

export class ResponseValidationError extends ClientError {
    override status = 500;

    constructor(messages: string[]) {
        super(`Response body is not valid:\n${messages.map(_ => `    - ${_}`).join('\n')}`);
        this.details = { messages };
    }
}
