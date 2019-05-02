# Application Structure

Typical microservices share the following directory structure:

```
src/                               // TypeScript sources
    main/
        entities/
        routes/
        repositories/
        services/
        util/                      // Helpers and utilities
        app.ts                     // Application class (IoC composition root)
        env.ts                     // Application-wide environment variables
        entrypoint.ts              // Application entrypoint (aka "main")
        ...                        // Database drivers and other modules with global lifecycle
    test/
out/                               // Compiled output (.js files)
    main/
    test/
```

## Common Snippets

Following modules should look similar across all applications. This makes it easier for the developers to find their ways around the application codebase.

### app.ts

```ts
import { Application } from '@ubio/framework';
import { MongoDb } from './mongodb';
import { MyService } from './services/my';
import { MyRouter } from './routers/my';
import { MyRepository } from './repositories/my';
// Add other imports (services, routers, repositories, etc.)

export function createApp() {
    const app = new Application();
    app.addStandardMiddleware();

    app.bindSingleton(MongoDb);
    // Bind other singletons

    app.bind(MyService);
    // Bind other services

    app.bindRouter(MyRouter);
    // Bind other routers

    app.beforeStart(async () => {
        const mongo = app.container.get<MongoDb>(MongoDb);
        await mongo.client.connect();
        await (app.container.get<MyRepository>(MyRepository)).createIndexes();
        // Add other code to execute on application startup
    });
    app.afterStop(async () => {
        const mongo = app.container.get<MongoDb>(MongoDb);
        mongo.client.close();
        // Add other finalization code
    });
    return app;
}

```

See [Application Container](./application.md) for more information.

### env.ts

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

### entrypoint.ts

```ts
import 'reflect-metadata';
import { createApp } from './app';
import { PORT } from './env';

const app = createApp();

app.start(PORT)
    .catch(err => {
        app.logger.error('Failed to start', err);
        process.exit(1);
    });
```

> Note: you don't have to import `reflect-metadata` everywhere; having it only in `entrypoint` is sufficient.

