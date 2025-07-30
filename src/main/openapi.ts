import { getGlobalRouteRegistry, RouteDefinition, RouteRole } from './router.js';
import { groupBy } from './util.js';

export function generateOpenApiSpec() {
    const doc: any = {};
    const routes = getGlobalRouteRegistry().filter(_ => _.role === RouteRole.ENDPOINT);
    const groupByPath = groupBy(routes, r => r.path);
    for (const [path, routes] of groupByPath) {
        doc[path] = {};
        for (const route of routes) {
            doc[path][route.method] = generateEndpointSpec(route);
        }
    }
    return doc;
}

function generateEndpointSpec(endpoint: RouteDefinition) {
    const spec: any = {
        summary: endpoint.summary,
        requestBody: generateRequestBodySpec(endpoint),
        parameters: generateParametersSpec(endpoint),
        responses: generateResponsesSpec(endpoint),
    };
    return spec;
}

function generateRequestBodySpec(endpoint: RouteDefinition) {
    if (endpoint.requestBodySchema) {
        return {
            required: true,
            content: {
                'application/json': {
                    schema: endpoint.requestBodySchema.schema,
                },
            }
        };
    }
    return undefined;
}

function generateParametersSpec(endpoint: RouteDefinition) {
    const result: any[] = [];
    for (const p of endpoint.params) {
        if (p.source === 'body') {
            // Body parameters are assembled into `requestBody` since OpenAPI v3
            continue;
        }
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

function generateResponsesSpec(route: RouteDefinition) {
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
