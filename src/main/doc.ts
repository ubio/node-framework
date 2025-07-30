import { getGlobalRouteRegistry, RouteDefinition, RouteRole } from './router.js';
import { groupBy } from './util.js';

export function generateEndpointDocSpec() {
    const doc: string[] = [];
    const routes = getGlobalRouteRegistry().filter(_ => _.role === RouteRole.ENDPOINT);
    const groupByPath = groupBy(routes, r => r.path);
    for (const [_path, routes] of groupByPath) {
        for (const route of routes) {
            doc.push(...generateEndpointSpec(route));
        }
    }
    return doc;
}

function generateEndpointSpec(endpoint: RouteDefinition): string[] {
    const name = endpoint.method.toUpperCase() + ' ' + endpoint.path;
    const header = buildHeader('##', name, endpoint.deprecated);

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
        let header = buildHeader('-', p.name, p.deprecated);
        const { type = '' } = p.schema as any;
        if (type) {
            header += ': ' + type.toString();
        }

        if (!p.required) {
            header += ' (optional)';
        }

        if (p.description) {
            header += ' - ' + p.description;
        }

        const spec = schemaToSpec(p.schema, 2);
        if (p.source === 'query') {
            queryParams.push(header, ...spec);
        } else {
            bodyParams.push(header, ...spec);
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
            const spec = schemaToSpec({
                contentType,
                body: schema
            });
            result.push(...spec);
        }
    }

    return result;
}

function schemaToSpec(schema: { [key: string]: any }, paddingNum = 0, requiredArray?: string[]) {
    const spec: string[] = [];
    const padding = ' '.repeat(paddingNum);

    if (schema?.type === 'object') {
        // if v has "type" and type is object
        // extract type required additionalProperties, and run schemaToSpec using properties
        const { required, properties = {} } = schema;
        const result = schemaToSpec(properties, paddingNum, required);
        spec.push(...result);
    } else {
        for (const [k, v = null] of Object.entries(schema)) {
            if (k === 'type') {
                continue;
            }

            const optional = requiredArray && !requiredArray.includes(k) ? '(optional)' : '';
            if (v == null || ['string', 'boolean', 'number'].includes(typeof v)) {
                spec.push(padding + `- ${k}: ${v}` + optional);
            } else if (Array.isArray(v)) {
                spec.push(padding + `- ${k}: ${v.toString() || '[]'}` + optional);
            } else {
                const { type, required } = v;
                const result = schemaToSpec(v, paddingNum + 2, required);
                spec.push(padding + `- ${k}: ${type || '{}'}` + optional); // duck tape for schema doesn't contain type
                spec.push(...result);
            }
        }
    }

    return spec;
}

function buildHeader(symbol: string, name: string, deprecated: boolean) {
    return symbol + (deprecated ? ' (**deprecated**)' : ' ') + name;
}
