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

