import { Entity, Field } from '../../main';

export class User extends Entity {

    @Field({
        schema: { type: 'string', minLength: 1 }
    })
    name: string = '';

}

export class Student extends User {

    @Field({
        schema: { type: 'number' }
    })
    gpa: number = 0;

}

export class Teacher extends User {

    @Field({
        schema: { type: 'string' }
    })
    major: string = '';

}
