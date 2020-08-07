import { Field, BaseEntity } from '../../main';

export class User extends BaseEntity {

    @Field({
        schema: { type: 'string', const: 'user' },
        serialized: false,
        presenters: ['public']
    })
    get object() { return 'user'; }

    @Field({
        schema: { type: 'string', format: 'uuid' },
        presenters: ['public']
    })
    organizationId: string = '';

    @Field({
        schema: { type: 'string', minLength: 6 },
        presenters: ['public']
    })
    username: string = '';

    @Field({
        schema: { type: 'string', minLength: 6 },
    })
    passwordSha256: string = '';

    @Field({
        schema: { default: null },
    })
    meta: any = { some: { meta: true, data: 'foobar' }, ts: 123 };

    notExposed = 'notExposed';
}
