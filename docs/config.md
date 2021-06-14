# Configuration

[It is common](https://12factor.net/config) to configure apps using environment variables.

Here's how you go about it in our framework:

```ts
import { config, Config } from '@ubio/framework';

export class MyStorageService {

    // This one does not have a default, app will fail to start if not provided
    @config() SECRET_KEY!: string;
    // The default is used
    @config({ default: 'some-bucket-name' }) BUCKET_NAME!: string;
    // You can use string, number and boolean types. Types are automatically coerced.
    @config({ default: 8080 }) PORT!: number;

    constructor(
        // This is not used directly, but is required by `@config` decorator.
        @inject(Config) public config: Config
    ) {
    }
}
```

## Generating .env.example

We use `.env.example` file to provide an example configuration for the app.

To generate it use:

```
npx generate-env
```

This will scan your `src/main/app.ts` to find which configs are actually in use by the application, leveraging some intense Inversify and Reflect magic. 🔮

## Notes

- The `config` property is required by `@config`, TypeScript will check that for you.
    - Due to TypeScript limitations the `config` property needs to be `public`, not `protected`, not `private`.
- The `Config` takes care of config resolution. It defaults to resolving from `process.env`, but you can replace it with any other resolution strategy (caveat: resolution has to be synchronous, so no database queries or http requests).
- The annotated properties are replaced with getters at runtime, which delegate the config resolution to `config: Config`. This means that the configs are resolved lazily and are not cached inside classes.
    - Among other things this means that changes to `process.env` will be immediately seen by all existing instances next time the decorated property is accessed.
