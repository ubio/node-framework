import { Configuration, Logger } from '@ubio/essentials';
import { injectable, inject } from 'inversify';
import dotenv from 'dotenv';

dotenv.config();

@injectable()
export class EnvConfiguration extends Configuration {

    constructor() {
        super();
        this.setAll(process.env);
    }

}
