import { Logger } from '@nodescript/logger';
import { Config, config, ConfigError, getMeshConfigs, ProcessEnvConfig } from 'mesh-config';
import { dep, Mesh } from 'mesh-ioc';

import { HttpRequestLogger, HttpServer } from './http.js';
import { StandardLogger } from './logger.js';
import { getGlobalMetrics } from './metrics/global.js';
import { MetricsPushGateway } from './metrics/push-gateway.js';
import { MetricsRouter } from './metrics/route.js';
import {
    AcAuthProvider,
    AutomationCloudJwtService,
    DefaultAcAuthProvider,
    JwtService,
} from './services/index.js';

/**
 * Application is an IoC composition root where all modules should be registered
 * and provides minimal lifecycle framework (start, stop, beforeStart, afterStop).
 */
export class Application {

    mesh = new Mesh('Global');

    @config({ default: false }) ASSERT_CONFIGS_ON_START!: boolean;

    @dep() httpServer!: HttpServer;
    @dep() logger!: Logger;

    constructor() {
        // Some default implementations are bound for convenience but can be replaced as fit
        this.mesh = this.createGlobalScope();
        this.mesh.connect(this);
    }

    createGlobalScope(): Mesh {
        const mesh = new Mesh('Global');
        mesh.constant('httpRequestScope', () => this.createHttpRequestScope());
        mesh.service(Logger, StandardLogger);
        mesh.alias('AppLogger', Logger);
        mesh.service(Config, ProcessEnvConfig);
        mesh.service(HttpServer);
        mesh.service(AutomationCloudJwtService);
        mesh.service(AcAuthProvider, DefaultAcAuthProvider);
        mesh.alias(JwtService, AutomationCloudJwtService);
        mesh.constant('GlobalMetrics', getGlobalMetrics());
        mesh.service(MetricsPushGateway);
        return mesh;
    }

    createHttpRequestScope(): Mesh {
        const mesh = new Mesh('HttpRequest');
        mesh.parent = this.mesh;
        mesh.service(Logger, HttpRequestLogger);
        mesh.service(MetricsRouter);
        return mesh;
    }

    async beforeStart(): Promise<void> {}

    async afterStop(): Promise<void> {}

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
        const configs = getMeshConfigs(this.mesh);
        const config = this.mesh.resolve(Config);
        for (const { key, type, defaultValue } of configs) {
            const value = config.getOrNull<any>(key, type, defaultValue);
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
