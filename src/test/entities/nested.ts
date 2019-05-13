import { Entity, Field } from '../../main';

export class City extends Entity {

    @Field({
        schema: { type: 'string', minLength: 1 }
    })
    name: string = '';

}

export class Country extends Entity {

    @Field({
        schema: { type: 'string', minLength: 3, maxLength: 3 }
    })
    code: string = '';

    @Field({
        schema: { type: 'object' },
        entity: City,
    })
    capital: City = new City();

    @Field({
        schema: { type: 'array' },
        entity: City,
    })
    cities: City[] = [];

    @Field({
        schema: { type: 'array', items: { type: 'string' } },
    })
    languages: string[] = [];

}
