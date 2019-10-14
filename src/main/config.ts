import { Configuration } from '@ubio/essentials';
import { injectable } from 'inversify';
import dotenv from 'dotenv';

dotenv.config();

@injectable()
export class EnvConfig extends Configuration {

    constructor() {
        super();
        this.setAll(process.env);
    }

}
