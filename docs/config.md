# Configuration

[It is common](https://12factor.net/config) to configure apps using environment variables.

Here's how you go about it in our framework:

```ts
import { config } from '@ubio/framework';

export class MyStorageService {

    // This one does not have a default, app will fail to start if not provided
    @config() SECRET_KEY!: string;
    // The default is used
    @config({ default: 'some-bucket-name' }) BUCKET_NAME!: string;
    // You can use string, number and boolean types. Types are automatically coerced.
    @config({ default: 8080 }) PORT!: number;

}
```

## Generating .env.example

We use `.env.example` file to provide an example configuration for the app.

To generate it use:

```
npx generate-env
```

This will scan your `src/main/app.ts` to find which configs are actually in use by the application, leveraging some IoC and Reflect magic. 🔮
