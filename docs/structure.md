# Application Structure

Typical microservices share the following directory structure:

```
src/                               // TypeScript sources
    bin/                           // Runnable entrypoints
        serve.ts                   // Start application HTTP server
    main/
        entities/                  // Deprecated
        routes/
        repositories/
        schema/                    // Describes domain model data structures
        services/
        util/                      // Helpers and utilities
        app.ts                     // Application class (IoC composition root)
        metrics.ts                 // Application metrics
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
```

### src/main/app.ts

```ts
import { Application } from '@ubio/framework';

export class App extends Application {

    // Note: application can inject global-scoped components
    @dep() mongodb!: MongoDb;

    override defineGlobalScope(mesh: Mesh) {
        mesh.service(MongoDb);
        mesh.service(MyService);
        mesh.service(MyRepository);
    }

    override defineHttpRequestScope(mesh: Mesh) {
        mesh.service(MyRouter);
    }

    async beforeStart() {
        await this.mongoDb.client.connect();
        await (this.mesh.resolve(MyRepository)).createIndexes();
        await this.httpServer.startServer();
        // Add other code to execute on application startup
    });

    async afterStop() {
        this.mongoDb.client.close();
        await this.httpServer.stopServer();
        // Add other finalization code
    }

}
```

See [Application Container](./application.md) for more information.

### src/bin/serve.ts

```ts
#!/usr/bin/env node
import 'reflect-metadata';
import { App } from '../main';

const app = new App();

app.start()
    .catch(err => {
        app.logger.error('Failed to start', err);
        process.exit(1);
    });
```

> Note: you don't have to import `reflect-metadata` everywhere; having it only in bin entrypoints is sufficient.
