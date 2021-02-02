import { MongoClient, Db, MongoClientOptions } from 'mongodb';
import { injectable, inject } from 'inversify';
import { FrameworkEnv } from '../main/env';
import { getGlobalMetrics, Logger } from '../main';

interface MongoClientOptionsExtended extends MongoClientOptions {
    useUnifiedTopology: boolean;
}

@injectable()
export class MongoDb {
    client: MongoClient;

    protected refreshing = false;

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
        this.startRefresh();
    }

    async stop() {
        this.stopRefresh();
        await this.client.close();
    }

    protected startRefresh() {
        this.refreshing = true;
        this.refreshLoop();
    }

    protected stopRefresh() {
        this.refreshing = false;
    }

    protected async refreshLoop() {
        while (this.refreshing) {
            try {
                await this.reportMetrics();
            } catch (error) {
                this.logger.warn('Could not refresh MongoDB metrics', { error });
            } finally {
                await new Promise(r => setTimeout(r, this.env.METRICS_REFRESH_INTERVAL).unref());
            }
        }
    }

    protected async reportMetrics() {
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
    }

}
