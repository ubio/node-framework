import { Get, Router } from '../../main/index.js';

export class ResponseSchemaRouter extends Router {

    @Get({
        path: '/valid',
        responses: {
            200: {
                schema: {
                    type: 'object',
                    required: ['number', 'string'],
                    properties: {
                        number: { type: 'number' },
                        string: { type: 'string' },
                    }
                }
            }
        }
    })
    async valid() {
        return {
            number: 1,
            string: 'one',
        };
    }

    @Get({
        path: '/missing',
    })
    async missing() {
        return {
            number: 1,
            string: 'one',
        };
    }

    @Get({
        path: '/invalid',
        responses: {
            200: {
                schema: {
                    type: 'object',
                    required: ['number', 'string', 'other'],
                    properties: {
                        number: { type: 'string' },
                        string: { type: 'string' },
                        other: {},
                    }
                }
            }
        }
    })
    async invalid() {
        return {
            number: 1,
            string: 'one',
        };
    }

}
