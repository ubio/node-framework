import { Config, config, ConfigError, getMeshConfigs, ProcessEnvConfig } from '@flexent/config';
import { Logger } from '@flexent/logger';
import { dep, Mesh } from '@flexent/mesh';

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
 * Application provides an IoC container where all modules should be registered
 * and provides minimal lifecycle framework (start, stop, beforeStart, afterStop).
 */
export class Application {

    mesh = new Mesh('Global');

    @config({ default: true }) ASSERT_CONFIGS_ON_START!: boolean;

    @dep() httpServer!: HttpServer;
    @dep() logger!: Logger;

    constructor() {
        // Some default implementations are bound for convenience but can be replaced as fit
        this.mesh.connect(this);
        this.mesh.constant('httpRequestScope', () => this.createHttpRequestScope());
        this.mesh.service(Logger, StandardLogger);
        this.mesh.alias('AppLogger', Logger);
        this.mesh.service(Config, ProcessEnvConfig);
        this.mesh.service(HttpServer);
        this.mesh.service(AutomationCloudJwtService);
        this.mesh.alias(JwtService, AutomationCloudJwtService);
        this.mesh.constant('GlobalMetrics', getGlobalMetrics());
        this.mesh.service(MetricsPushGateway);
        this.defineGlobalScope(this.mesh);
    }

    createSessionScope(): Mesh {
        const mesh = new Mesh('Session');
        mesh.parent = this.mesh;
        mesh.service(MetricsRouter);
        mesh.service(AcAuthProvider, DefaultAcAuthProvider);
        this.defineSessionScope(mesh);
        return mesh;
    }

    createHttpRequestScope(): Mesh {
        const mesh = new Mesh('HttpRequest');
        mesh.parent = this.createSessionScope();
        mesh.service(Logger, HttpRequestLogger);
        this.defineHttpRequestScope(mesh);
        return mesh;
    }

    defineGlobalScope(_mesh: Mesh) {}
    defineSessionScope(_mesh: Mesh) {}
    defineHttpRequestScope(_mesh: Mesh) {}

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
