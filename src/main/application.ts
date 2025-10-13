import { Logger } from '@nodescript/logger';
import { AuxHttpServer, BaseApp } from '@nodescript/microframework';
import { Config, config, ConfigError, getMeshConfigs } from 'mesh-config';
import { dep, Mesh } from 'mesh-ioc';

import { HttpRequestLogger, HttpServer } from './http.js';
import { GlobalMetrics } from './metrics/global.js';


/**
 * Application is an IoC composition root where all modules should be registered
 * and provides minimal lifecycle framework (start, stop, beforeStart, afterStop).
 */
export class Application extends BaseApp {

    @config({ default: false }) ASSERT_CONFIGS_ON_START!: boolean;
    @config({ default: true }) START_AUX_HTTP_ON_START!: boolean;

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
        this.mesh.service(GlobalMetrics);
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
        if (this.START_AUX_HTTP_ON_START) {
            await this.auxHttpServer.start();
        }
        await this.beforeStart();
    }

    override async stop() {
        await super.stop();
        if (this.START_AUX_HTTP_ON_START) {
            await this.auxHttpServer.stop();
        }
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

    /**
     * Expose configureEnv from BaseApp for direct invocation.
     *
     * @example
     * const app = new App();
     * app.configureEnv(); // Load .env files without calling app.start()
     */
    override configureEnv(): void {
        super.configureEnv();
    }

}
