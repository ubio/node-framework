# Environment Variables

Environment variables contain application configuration which is likely to vary between deploys.
Such configuration may include http ports, database connection specifications and credentials, endpoint URLs and credentials to other services, etc.

## Example

Application-wide environment variables are defined in `src/main/env.ts`:

```ts
import dotenv from 'dotenv';
import { env } from '@ubio/framework';

dotenv.config();

export const PORT = env.readNumber('PORT');
export const GCLOUD_KEYFILE = env.readString('GCLOUD_KEYFILE');
export const BUCKET_NAME = env.readString('BUCKET_NAME', 'default-bucket-name');

environment.assertEnv();
```

To consume environment variables from other modules:

```ts
import { PORT } from '../env';

console.log(PORT);
```

## Key concepts

1. [dotenv](https://www.npmjs.com/package/dotenv) is used *in development* to load the environment from `.env` file.
    - Committing `.env` is strongly discouraged (see dotenv [FAQ](https://www.npmjs.com/package/dotenv#faq)), so it is recommended to add `.env` to `.gitignore`
    - It is a good practice to include `.env.example` with default env values so that other developer can set up their enviroments more quickly
2. Environment is read using `readNumber` and `readString` methods. Both take environment variable name as its first argument and support an optional second argument with default value. If default value is not provided, variable is considered required.
3. Finally, `assert` is used at the end to validate the presence of all required fields. If at least one of the required variables is missing, application will fail to start and throw an error describing which variables are missing so that it is easier for devops to spot and fix misconfiguration.
4. Only strings and numbers are supported. Booleans are supported implicitly via `readString('MY_VAR', 'false') === 'true'`.
