import { Router, Post, BodyParam } from '../../main';

export class MultipartRouter extends Router {

    @Post({
        path: '/upload',
        responses: {
            200: { contentType: 'application/json' }
        }
    })
    async update(
        @BodyParam('foo', { schema: { type: 'string' }})
        foo: string
    ) {
        const { myFile } = this.ctx.request.files!;
        return {
            foo,
            fileSize: myFile.size,
        };
    }
}
