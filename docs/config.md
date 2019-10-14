# Configuration

Node Framework v2 introduced a different approach to configuring application components.

> The approach has originally developed from a proposal in `hive`. The original [PR](https://github.com/universalbasket/hive/pull/680) has some context and reasoning.

This new approach focuses on achieving following objectives:

- **decentralization**: configurable components will declare the properties in their modules, as opposed to previous centralized configuration approach where all configurable values are declared in a single `env.ts` module
- **discoverability**: it should be possible to get a full list of all available configurations after the modules are loaded; this is achieved by introducing a mandatory declaration of configuration properties and separating such declaration from obtaining the actual values
- **type safety**: achieved by using generics in config declarations
- **default values**: lifted to declaration level, default values expose the information about safe defaults suitable for normal operation
- **constrained shareability**: multiple modules can use the same configuration property and thus may declare it more than once — but they are required to do that in 100% consistent way (types and default values must match)
- **testability**: with `env` being global it is very cumbersome to test how different modules behave in different configurations

## Usage

A module that needs things configured must do two things:

1. declare configuration parameters it is using via `stringConfig`, `numberConfig` or `booleanConfig` functions; these declarations are top-level and thus get collected into a single shared registry of all configurations
2. obtain a `Configuration` instance which holds the actual configuration values and use it for resolving the values when needed

Consider the following example:

```ts
import IORedis from 'ioredis';
import { injectable, inject } from 'inversify';
import { stringConfig, Configuration } from '@ubio/framework';

const REDIS_URL = stringConfig('REDIS_URL');

@injectable()
export class RedisService {
    config: Configuration;
    client: IORedis.Redis;

    constructor(
        @inject(Configuration)
        config: Configuration
    ) {
        this.config = config;
        this.client = new IORedis(this.config.get(REDIS_URL));
    }
}
```

Here `REDIS_URL` is first declared and then subsequently used to retrieve a value from `config`, which is automatically injected by Framework.

By default `Configuration` resolves into `EnvConfiguration` instance which simply loads all configurations from `process.env` and is therefore an equivalent of previous `env` approach.

## Asserting required values

By default `EnvConfiguration` logs a warning if some of the mandatory configuration properties are not specified. This is intentional, since decentralized design demands the application to remain functional even if some of its parts are unavailable or minsconfigured.

To enforce all configurations to be present you would need to bind a custom implementation of `Configuration` which, after initializing the values from some source, would throw an exception if any configuration value is missing, e.g.:

```ts
@injectable()
export class MandatoryEnvConfiguration extends Configuration {
    logger: Logger;

    constructor(
        @inject(Logger)
        logger: Logger
    ) {
        super();
        this.logger = logger;
        this.setAll(process.env);
        const missing = this.getMissingConfigs();
        if (missing.length > 0) {
            const keys = missing.map(_ => _.key);
            this.logger.error('Missing configuration keys', { keys });
            process.exit(1);
        }
    }
}

```

## Accessing configuration registry

It is possible to obtain all configurations declared by all the modules:

```ts
import { getConfigDeclarations } from '@ubio/framework';

for (const config of getConfigDeclarations().values) {
    // config will contain { key, type, defaultValue }
}
```