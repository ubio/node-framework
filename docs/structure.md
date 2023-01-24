# Application Structure

Typical microservices share the following directory structure:

```
src/                               // TypeScript sources
    bin/                           // Runnable entrypoints
        serve.ts                   // Start application HTTP server
    main/
        routes/                    // The functionality exposed by the application via HTTP
        repositories/              // Storage abstraction layer
        services/                  // Business logic abstraction layere
        schema/                    // Domain model data structures
        util/                      // Helpers and utilities
        app.ts                     // Application class (IoC composition root)
        metrics.ts                 // Application metrics
        ...                        // Database drivers and other modules with global lifecycle
    test/
out/                               // Compiled output (.js and .d.ts files)
    main/
    test/
```

## Common Snippets

Following modules should look similar across all applications. This makes it easier for the developers to find their ways around the application codebase.

### src/main/app.ts

```ts
import { Application } from '@ubio/framework';

export class App extends Application {

    // Note: application can inject global-scoped components
    @dep() mongodb!: MongoDb;

    override createGlobalScope() {
        const mesh = super.createGlobalScope();
        mesh.service(MongoDb);
        mesh.service(MyService);
        mesh.service(MyRepository);
        return mesh;
    }

    override createHttpRequestScope() {
        const mesh = super.createHttpRequestScope();
        mesh.service(MyRouter);
        return mesh;
    }

    async beforeStart() {
        await this.mongoDb.client.connect();
        // Add other code to execute on application startup
        await this.httpServer.startServer();
    });

    async afterStop() {
        await this.httpServer.stopServer();
        // Add other finalization code
        this.mongoDb.client.close();
    }

}
```

See [Application Container](./application.md) for more information.

### src/bin/serve.ts

The entrypoint is the only module that actually runs stuff when imported.
Every other module should only export things without side effects.

```ts
#!/usr/bin/env node
import 'reflect-metadata';
import { App } from '../main/app.js';

const app = new App();

try {
    await app.start()
} catch (error) {
    app.logger.error('Failed to start', err);
    process.exit(1);
}
```
