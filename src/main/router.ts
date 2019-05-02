import { injectable, inject } from 'inversify';
import * as koa from 'koa';
import escapeRegexp from 'escape-string-regexp';
import Ajv from 'ajv';
import { Logger } from './logger';
import {
    Constructor, deepClone, ajvErrorToMessage, createError, AnyConstructor, groupBy
} from './util';

const ROUTES_KEY = Symbol('Route');
const PARAMS_KEY = Symbol('Param');

// Lightweight routing based on IoC and decorators.

const ajv = new Ajv({
    coerceTypes: 'array',
    allErrors: true,
    useDefaults: true,
    jsonPointers: true
});

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
        const route: RouteDefinition = {
            deprecated,
            methodKey,
            isMiddleware,
            summary,
            method,
            path,
            pathTokens: tokenizePath(path),
            params,
            paramsValidateFn: createParamValidateFn(params),
            responses
        };
        validateRoute(route);
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
            required = false,
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

    params: Params = {};

    async handle(): Promise<boolean> {
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
            if (response != null) {
                this.ctx.body = response;
            }
            return true;
        }
        // No routes match
        return false;
    }

    async executeRoute(ep: RouteDefinition, pathParams: Params): Promise<any> {
        const query: any = deepClone(this.ctx.request.query || {});
        const body: any = deepClone(this.ctx.request.body || {});
        // First assemble the parameters into an object and validate them
        const paramsObject: any = {};
        for (const p of ep.params) {
            const val: any = p.source === 'path' ? pathParams[p.name] :
                p.source === 'query' ? query[p.name] :
                p.source === 'body' ? body[p.name] : null;
            paramsObject[p.name] = val;
        }
        const valid = ep.paramsValidateFn(paramsObject);
        if (!valid) {
            const messages = ep.paramsValidateFn.errors!.map(e => ajvErrorToMessage(e));
            throw createError({
                name: 'RequestParametersValidationError',
                status: 400,
                details: {
                    messages
                }
            });
        }
        // Retrieve the parameters by name, because validator will apply coercion and defaults
        const paramsArray: any[] = new Array(ep.params.length);
        for (const p of ep.params) {
            paramsArray[p.index] = paramsObject[p.name];
        }
        // Bind params to router instance, so that the route can use them
        this.params = paramsObject;
        return await (this as any)[ep.methodKey](...paramsArray);
    }

    generateDocs(): object {
        return generateRouterDocumentation(this.constructor as Constructor<Router>);
    }

    // Presenter helpers

    presentList(type: string, items: any[], totalCount: number): object {
        return {
            object: 'list',
            count: totalCount,
            data: items.map(o => this.presentObject(type, o))
        };
    }

    presentObject(type: string, object: object): object {
        return {
            object: type,
            ...object
        };
    }

}

function validateRoute(ep: RouteDefinition) {
    const paramNamesSet: Set<string> = new Set();
    for (const param of ep.params) {
        if (paramNamesSet.has(param.name)) {
            throw createError({
                name: 'InvalidRouteDefinition',
                message: `Parameter ${param.name} is declared more than once`
            });
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

function createParamValidateFn(params: ParamDefinition[] = []): Ajv.ValidateFunction {
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
        additionalProperties: true,
    });
}

// Path tokenization and matching

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
        tokens.push({ type: 'param', value: m[1] });
        m = re.exec(path);
    }
    const suffix = path.substring(idx);
    if (suffix) {
        tokens.push({ type: 'string', value: suffix });
    }
    return tokens;
}

export function matchPath(
    path: string,
    tokens: PathToken[],
    matchStart: boolean = false
): Params | null {
    const params: Params = {};
    const regex = tokens
        .map(tok => tok.type === 'string' ? escapeRegexp(tok.value) : '([^/\.:]+?)')
        .join('');
    const re = new RegExp('^' + regex + (matchStart ? '(?=$|[/\.:])' : '$'));
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

// Helpers for accessing metadata and generating docs

export function getAllRoutes(routerClass: AnyConstructor): RouteDefinition[] {
    return Reflect.getMetadata(ROUTES_KEY, routerClass.prototype) || [];
}

export function getMiddlewareRoutes(routerClass: AnyConstructor) {
    return getAllRoutes(routerClass).filter(ep => ep.isMiddleware);
}

export function getEndpointRoutes(routerClass: AnyConstructor) {
    return getAllRoutes(routerClass).filter(ep => !ep.isMiddleware);
}

export function generateRouterDocumentation(routerClass: AnyConstructor) {
    const doc: any = {};
    const routes = getEndpointRoutes(routerClass);
    const groupByPath = groupBy(routes, r => r.path);
    for (const [path, routes] of groupByPath) {
        doc[path] = {};
        for (const route of routes) {
            doc[path][route.method] = {
                summary: route.summary,
                parameters: generateEndpointParametersDocs(route),
                responses: generateEndpointResponsesDocs(route),
            };
        }
    }
    return doc;
}

export function generateEndpointParametersDocs(endpoint: RouteDefinition) {
    const result: any[] = [];
    for (const p of endpoint.params) {
        result.push({
            name: p.name,
            in: p.source,
            description: p.description,
            required: p.required || false,
            deprecated: p.deprecated || false,
            schema: p.schema
        });
    }
    return result;
}

export function generateEndpointResponsesDocs(route: RouteDefinition) {
    const result: any = {};
    for (const [status, resp] of Object.entries(route.responses)) {
        const {
            contentType = 'application/json',
            description = '',
            schema = {},
        } = resp;
        const spec = {
            description,
            content: {}
        };
        const contentTypes = Array.isArray(contentType) ? contentType : [contentType];
        for (const contentType of contentTypes) {
            (spec.content as any)[contentType] = { schema };
        }
        result[status.toString()] = spec;
    }
    return result;
}

export interface Params {
    [key: string]: any;
}

export interface PathToken {
    type: 'string' | 'param';
    value: string;
}

export type ParamSource = 'path' | 'query' | 'body';

export interface RouteDefinition {
    methodKey: string;

    summary: string;
    deprecated: boolean;
    isMiddleware: boolean;
    method: string;
    path: string;
    pathTokens: PathToken[];
    params: ParamDefinition[];
    paramsValidateFn: Ajv.ValidateFunction;
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
