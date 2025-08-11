import { Logger } from '@nodescript/logger';
import { AuxHttpServer, BaseApp } from '@nodescript/microframework';
import { Config, config, ConfigError, getMeshConfigs } from 'mesh-config';
import { dep, Mesh } from 'mesh-ioc';

import { HttpRequestLogger, HttpServer } from './http.js';
import { getGlobalMetrics } from './metrics/global.js';
import { AcAuthProvider, DefaultAcAuthProvider } from './services/ac-auth-provider.js';
import { AutomationCloudJwtService, JwtService } from './services/jwt.js';


/**
 * Application is an IoC composition root where all modules should be registered
 * and provides minimal lifecycle framework (start, stop, beforeStart, afterStop).
 */
export class Application extends BaseApp {

    @config({ default: false }) ASSERT_CONFIGS_ON_START!: boolean;
    @config({ default: true }) START_AUX_HTTP_SERVER_ON_START!: boolean;

    @dep() httpServer!: HttpServer;
    @dep() auxHttpServer!: AuxHttpServer;

    constructor() {
        super(new Mesh('App'));
        this.createGlobalScope();
    }

    createGlobalScope(): Mesh {
        this.mesh.constant('httpRequestScope', () => this.createHttpRequestScope());
        this.mesh.alias('AppLogger', Logger);
        this.mesh.service(HttpServer);
        this.mesh.service(AutomationCloudJwtService);
        this.mesh.service(AcAuthProvider, DefaultAcAuthProvider);
        this.mesh.alias(JwtService, AutomationCloudJwtService);
        this.mesh.constant('GlobalMetrics', getGlobalMetrics());
        return this.mesh;
    }

    createHttpRequestScope(): Mesh {
        const mesh = new Mesh('HttpRequestScope', this.mesh);
        mesh.service(Logger, HttpRequestLogger);
        return mesh;
    }

    async beforeStart(): Promise<void> {}

    async afterStop(): Promise<void> {}

    override async start() {
        await super.start();
        if (this.ASSERT_CONFIGS_ON_START) {
            this.assertConfigs();
        }
        if (this.START_AUX_HTTP_SERVER_ON_START) {
            await this.auxHttpServer.start();
        }
        await this.beforeStart();
    }

    override async stop() {
        await super.stop();
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
