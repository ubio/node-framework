import { Logger } from '@flexent/logger';
import { Container } from 'inversify';

import { Config, config, ConfigError, DefaultConfig, getContainerConfigs } from './config.js';
import { HttpServer } from './http.js';
import { StandardLogger } from './logger.js';
import { getGlobalMetrics } from './metrics/global.js';
import { MetricsRegistry } from './metrics/index.js';
import { MetricsPushGateway } from './metrics/push-gateway.js';
import { MetricsRouter } from './metrics/route.js';
import { Router } from './router.js';
import {
    AcAuthProvider,
    AutomationCloudJwtService,
    DefaultAcAuthProvider,
    JwtService,
} from './services/index.js';

/**
 * Application provides an IoC container where all modules should be registered
 * and provides minimal lifecycle framework (start, stop, beforeStart, afterStop).
 */
export class Application {
    container: Container;

    @config({ default: true }) ASSERT_CONFIGS_ON_START!: boolean;

    constructor() {
        const container = new Container({ skipBaseClassChecks: true });
        this.container = container;
        // Some default implementations are bound for convenience but can be replaced as fit
        this.container.bind('RootContainer').toConstantValue(container);
        this.container.bind(Logger).to(StandardLogger).inSingletonScope();
        this.container.bind('AppLogger').toService(Logger);
        this.container.bind(Config).to(DefaultConfig).inSingletonScope();
        this.container.bind(HttpServer).toSelf().inSingletonScope();
        this.container.bind(Router).to(MetricsRouter);
        this.container.bind(MetricsPushGateway).toSelf();
        this.container.bind(MetricsRegistry).toConstantValue(getGlobalMetrics());
        this.container.bind(JwtService).to(AutomationCloudJwtService).inSingletonScope();
        this.container.bind(AcAuthProvider).to(DefaultAcAuthProvider);
    }

    get logger(): Logger {
        return this.container.get(Logger);
    }

    get config(): Config {
        return this.container.get(Config);
    }

    get httpServer(): HttpServer {
        return this.container.get(HttpServer);
    }

    async beforeStart(): Promise<void> {}

    async afterStop(): Promise<void> {}

    bindMetrics(constructor: (new(...args: any[]) => MetricsRegistry)): this {
        // Metrics registries should be bound in singleton scope,
        // and same instances must be appended to MetricsRegistry bindings
        this.container.bind(constructor).toSelf().inSingletonScope();
        this.container.bind(MetricsRegistry).toService(constructor);
        return this;
    }

    bindRouter(constructor: (new(...args: any[]) => Router)): this {
        this.container.bind(Router).to(constructor);
        return this;
    }

    async start() {
        process.on('uncaughtException', error => {
            this.logger.error('uncaughtException', { error });
        });
        process.on('unhandledRejection', error => {
            this.logger.error('unhandledRejection', { error });
        });
        process.on('SIGTERM', () => this.logger.info('Received SIGTERM'));
        process.on('SIGINT', () => this.logger.info('Received SIGINT'));
        process.on('SIGTERM', () => this.stop());
        process.on('SIGINT', () => this.stop());
        if (this.ASSERT_CONFIGS_ON_START) {
            this.assertConfigs();
        }
        await this.beforeStart();
    }

    async stop() {
        // TODO uninstall process signals handlers better
        process.removeAllListeners();
        await this.afterStop();
    }

    getMissingConfigKeys() {
        const missingConfigs = new Set<string>();
        const configs = getContainerConfigs(this.container);
        for (const { key, type, defaultValue } of configs) {
            const value = this.config.getOrNull<any>(key, type, defaultValue);
            if (value == null) {
                missingConfigs.add(key);
            }
        }
        return [...missingConfigs];
    }

    assertConfigs() {
        const missingConfigs = this.getMissingConfigKeys();
        if (missingConfigs.length > 0) {
            throw new ConfigError('Missing required configuration:\n' +
                missingConfigs.map(_ => `    - ${_}`).join('\n'));
        }
    }

}
