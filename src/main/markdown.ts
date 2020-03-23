import { getGlobalRouteRegistry, RouteDefinition } from './router';
import { groupBy } from './util';

export function generateMarkdownApiSpec() {
    const doc = [] as any;
    const routes = getGlobalRouteRegistry().filter(_ => !_.isMiddleware);
    const groupByPath = groupBy(routes, r => r.path);
    for (const [_path, routes] of groupByPath) {
        for (const route of routes) {
            doc.push(...generateEndpointSpec(route));
        }
    }
    return doc;
}

function generateEndpointSpec(endpoint: RouteDefinition): string[] {
    const method = endpoint.method.toUpperCase();
    let header = `## ${method} ${endpoint.path}`;
    if (endpoint.deprecated) {
        header += ' **(deprecated)**';
    }

    const { queryParams, bodyParams } = generateParamSpec(endpoint);
    const responses = generateResponsesSpec(endpoint);

    const spec: string [] = [
        '\n',
        header,
        endpoint.summary.trim(),
    ];

    if (queryParams.length > 0) {
        spec.push('\n', '### Query Params', ...queryParams);
    }

    if (bodyParams.length > 0) {
        spec.push('\n', '### Body Params', ...bodyParams);
    }

    if (responses.length > 0) {
        spec.push('\n', '### Responses', ...responses);
    }

    return spec;
}

function generateParamSpec(endpoint: RouteDefinition) {
    const bodyParams: string[] = [];
    const queryParams: string[] = [];

    for (const p of endpoint.params) {
        let header = '- ' + p.name;

        if (p.required) {
            header += ' (*required*)';
        }

        if (p.deprecated) {
            header += ' (*deprecated*)';
        }

        if (p.description) {
            header += ' :' + p.description;
        }

        // extract schema to string spec.
        const schema = schemaToSpec(p.schema, 2);
        if (p.source === 'query') {
            queryParams.push(header, ...schema);
        } else {
            bodyParams.push(header, ...schema);
        }
    }

    return { queryParams, bodyParams };
}

function generateResponsesSpec(route: RouteDefinition) {
    const result: string[] = [];
    for (const [status, resp] of Object.entries(route.responses)) {
        result.push('#### Status: ' + status);
        const {
            contentType = 'application/json',
            description = '',
            schema = {},
        } = resp;

        if (description) {
            result.push(description);
        }

        const contentTypes = Array.isArray(contentType) ? contentType : [contentType];
        for (const contentType of contentTypes) {
            result.push(...schemaToSpec({
                contentType,
                body: schema
            }));
        }
    }

    return result;
}

function schemaToSpec(schema: { [key: string]: any }, paddingNum = 0, required: string[] = []) {
    const spec: string[] = [];
    const padding = ' '.repeat(paddingNum);

    for (const [k, v] of Object.entries(schema)) {
        if (k === 'required' || k === 'additionalProperties') {
            continue;
        }

        const suffix = required.includes(k) ? ' (*required*)' : '';
        if (Array.isArray(v)) {
            spec.push(padding + `- ${k}: ${v.toString() || '[]'}` + suffix);
        }
        // object
        else if (typeof v === 'object') {
            const { required } = schema;
            const result = schemaToSpec(v,  paddingNum + 2, required);
            spec.push(padding + `- ${k}` + suffix);
            spec.push(...result);
        } else {
            // 'string', 'boolean', 'number'
            spec.push(padding + `- ${k}: ${v}` + suffix);
        }
    }

    return spec;
}
