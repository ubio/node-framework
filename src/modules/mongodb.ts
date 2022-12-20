import { config } from '@nodescript/config';
import { Logger } from '@nodescript/logger';
import { dep } from 'mesh-ioc';
import { Db, MongoClient, MongoClientOptions } from 'mongodb';

import { getGlobalMetrics } from '../main/index.js';

interface MongoClientOptionsExtended extends MongoClientOptions {
    useUnifiedTopology: boolean;
}

export class MongoDb {
    client: MongoClient;

    protected refreshingMetrics = false;

    @config() MONGO_URL!: string;
    @config({ default: process.env.NODE_ENV !== 'test' }) MONGO_METRICS_ENABLED!: boolean;
    @config({ default: 10000 }) MONGO_METRICS_REFRESH_INTERVAL!: number;

    @dep() protected logger!: Logger;

    constructor() {
        this.client = new MongoClient(this.MONGO_URL, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            ignoreUndefined: true,
        } as MongoClientOptionsExtended);
    }

    get db(): Db {
        return this.client.db();
    }

    async start() {
        await this.client.connect();
        if (this.MONGO_METRICS_ENABLED) {
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
                await new Promise(r => setTimeout(r, this.MONGO_METRICS_REFRESH_INTERVAL).unref());
            }
        }
    }

}
