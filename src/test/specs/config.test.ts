import assert from 'assert';
import { inject, injectable } from 'inversify';

import { Application, Config, config } from '../../main';

describe('Config', () => {

    @injectable()
    class SomeService {

        constructor(
            @inject(Config)
            public config: Config,
        ) {}

        @config() SOME_STRING!: string;
        @config() SOME_NUMBER!: number;
        @config() SOME_BOOLEAN!: boolean;

        @config({ default: 'foo' }) STRING_WITH_DEFAULT!: string;
        @config({ default: 8080 }) NUMBER_WITH_DEFAULT!: number;
        @config({ default: true }) BOOLEAN_WITH_DEFAULT!: boolean;

    }

    describe('configs missing', () => {
        const app = new Application();
        app.container.bind(SomeService).toSelf();
        app.container.rebind(Config).to(class extends Config {
            resolve(_key: string): string | null {
                return null;
            }
        });

        it('throws when accessing configs without defaults', () => {
            const service = app.container.get(SomeService);
            const keys = ['SOME_STRING', 'SOME_NUMBER', 'SOME_BOOLEAN'];
            for (const key of keys) {
                try {
                    void (service as any)[key];
                } catch (err) {
                    assert.strictEqual(err.name, 'ConfigError');
                }
            }
        });

        it('returns default values where provided', () => {
            const service = app.container.get(SomeService);
            assert.strictEqual(service.STRING_WITH_DEFAULT, 'foo');
            assert.strictEqual(service.NUMBER_WITH_DEFAULT, 8080);
            assert.strictEqual(service.BOOLEAN_WITH_DEFAULT, true);
        });
    });

    describe('configs specified', () => {
        const app = new Application();
        app.container.bind(SomeService).toSelf();
        app.container.rebind(Config).to(class extends Config {
            map = new Map([
                ['SOME_STRING', 'hello'],
                ['SOME_NUMBER', '888'],
                ['SOME_BOOLEAN', 'false'],
                ['STRING_WITH_DEFAULT', 'hello'],
                ['NUMBER_WITH_DEFAULT', '999'],
                ['BOOLEAN_WITH_DEFAULT', 'true'],
            ]);
            resolve(key: string): string | null {
                return this.map.get(key) ?? null;
            }
        });

        it('returns override values', () => {
            const service = app.container.get(SomeService);
            assert.strictEqual(service.SOME_STRING, 'hello');
            assert.strictEqual(service.SOME_NUMBER, 888);
            assert.strictEqual(service.SOME_BOOLEAN, false);
            assert.strictEqual(service.STRING_WITH_DEFAULT, 'hello');
            assert.strictEqual(service.NUMBER_WITH_DEFAULT, 999);
            assert.strictEqual(service.BOOLEAN_WITH_DEFAULT, true);
        });
    });

});
