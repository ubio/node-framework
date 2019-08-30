# Application Structure

Typical microservices share the following directory structure:

```
src/                               // TypeScript sources
    bin/                           // Runnable entrypoints
        serve.ts                   // Start application HTTP server
    main/
        entities/
        routes/
        repositories/
        services/
        util/                      // Helpers and utilities
        app.ts                     // Application class (IoC composition root)
        env.ts                     // Application-wide environment variables
        index.ts                   // Modules exported by application
        ...                        // Database drivers and other modules with global lifecycle
    test/
out/                               // Compiled output (.js files)
    main/
    test/
```

## Common Snippets

Following modules should look similar across all applications. This makes it easier for the developers to find their ways around the application codebase.

### src/main/index.ts

```ts
export * from './app';
export * from './env';
```

### src/main/app.ts

```ts
import { Application } from '@ubio/framework';
import { MongoDb } from './mongodb';
import { MyService } from './services/my';
import { MyRouter } from './routers/my';
import { MyRepository } from './repositories/my';
// Add other imports (services, routers, repositories, etc.)

export class App extends Application {
    constructor() {
        this.addStandardMiddleware();
        this.bindSingleton(MongoDb);
        // Bind other singletons
        this.bind(MyService);
        // Bind other services
        this.bindRouter(MyRouter);
        // Bind other routers
        this.beforeStart(async () => {
            const mongo = this.container.get<MongoDb>(MongoDb);
            await mongo.client.connect();
            await (this.container.get<MyRepository>(MyRepository)).createIndexes();
            // Add other code to execute on application startup
        });
        this.afterStop(async () => {
            const mongo = this.container.get<MongoDb>(MongoDb);
            mongo.client.close();
            // Add other finalization code
        });
    }
}

```

See [Application Container](./application.md) for more information.

### src/main/env.ts

```ts
import dotenv from 'dotenv';
import { env } from '@ubio/framework';

dotenv.config();

export const PORT = env.readNumber('PORT');
export const MONGO_URL = env.readString('MONGO_URL');
export const MONGO_DB = env.readString('MONGO_DB');
// Add other environment variables

env.assertEnv();
```

See [Environment Variables](./env.md) for more information.

### src/bin/serve.ts

```ts
#!/usr/bin/env node
import 'reflect-metadata';
import { App, PORT } from '../main';

const app = new App();

app.startServer(PORT)
    .catch(err => {
        app.logger.error('Failed to start', err);
        process.exit(1);
    });
```

> Note: you don't have to import `reflect-metadata` everywhere; having it only in bin entrypoints is sufficient.
