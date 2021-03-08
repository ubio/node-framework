import { inject, injectable } from 'inversify';
import { Db, MongoClient, MongoClientOptions } from 'mongodb';

import { getGlobalMetrics, Logger } from '../main';
import { FrameworkEnv } from '../main/env';

interface MongoClientOptionsExtended extends MongoClientOptions {
    useUnifiedTopology: boolean;
}

@injectable()
export class MongoDb {
    client: MongoClient;

    protected refreshingMetrics = false;

    constructor(
        @inject(FrameworkEnv)
        protected env: FrameworkEnv,
        @inject(Logger)
        protected logger: Logger,
    ) {
        this.client = new MongoClient(env.MONGO_URL, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            connectWithNoPrimary: true,
            ignoreUndefined: true,
        } as MongoClientOptionsExtended);
    }

    get db(): Db {
        return this.client.db();
    }

    async start() {
        await this.client.connect();
        if (this.env.MONGO_METRICS_ENABLED) {
            this.startRefreshMetrics();
        }
    }

    async stop() {
        this.stopRefreshMetrics();
        await this.client.close();
    }

    startRefreshMetrics() {
        this.refreshingMetrics = true;
        this.refreshMetricsLoop();
    }

    stopRefreshMetrics() {
        this.refreshingMetrics = false;
    }

    protected async refreshMetricsLoop() {
        while (this.refreshingMetrics) {
            try {
                const metrics = getGlobalMetrics();
                const collections = await this.db.listCollections().toArray();
                const counts = await Promise.all(
                    collections.map(col => this.db.collection(col.name).estimatedDocumentCount()));
                for (const [i, col] of collections.entries()) {
                    metrics.mongoDocumentsTotal.set(counts[i], {
                        collection: col.name,
                        db: this.db.databaseName,
                    });
                }
            } catch (error) {
                this.logger.warn('Could not refresh MongoDB metrics', { error });
            } finally {
                await new Promise(r => setTimeout(r, this.env.METRICS_REFRESH_INTERVAL).unref());
            }
        }
    }

}
