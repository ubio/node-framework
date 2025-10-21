import { Logger } from '@nodescript/logger';
import { Redis } from 'ioredis';
import { config } from 'mesh-config';
import { dep } from 'mesh-ioc';

import { AccessForbidden } from './ac-auth.js';

export interface TrialServiceRestriction {
    serviceName: string;
    requestCount: number;
}

export interface Trial {
    serviceRestrictions: Array<TrialServiceRestriction>;
}

export interface TokenServiceRestriction {
    serviceName: string;
    requestLimit: number;
}

export class TrialClient {

    @config() private REDIS_URL!: string;
    @dep() private logger!: Logger;

    private isRunning = false;
    private trialKeyPrefix = 'cache:framework:trialClient';

    redisClient: Redis;

    constructor() {
        this.redisClient = this.createRedisClient();
    }

    async start() {
        if (this.isRunning) {
            return;
        }
        this.isRunning = true;
        await this.redisClient.connect();
        this.logger.info('TrialClient Redis connected');
    }

    async stop() {
        try {
            this.redisClient.disconnect();
            this.logger.info('TrialClient Redis disconnected');
        } finally {
            this.isRunning = false;
        }
    }

    private createRedisClient() {
        return new Redis(this.REDIS_URL, {
            lazyConnect: true,
            disconnectTimeout: 10,
        });
    }

    isTrialToken(token: Record<string, any>) {
        return !!token.serviceRestrictions;
    }

    async assertTrial(token: Record<string, any>) {
        const trial = await this.read(token.clientId);
        if (!trial) {
            throw new AccessForbidden('Trial access for token not configured');
        }
        return trial;
    }

    async requireValidServiceRestriction(trial: Trial, token: Record<string, any>, serviceName: string) {
        const serviceRestriction = trial.serviceRestrictions.find((service: TrialServiceRestriction) => service.serviceName === serviceName);
        const tokenServiceRestriction = token.serviceRestrictions.find((service: TokenServiceRestriction) => service.serviceName === serviceName);

        if (!serviceRestriction || !tokenServiceRestriction) {
            throw new AccessForbidden('Service access for token not configured');
        }
        if (serviceRestriction.requestCount > tokenServiceRestriction.requestLimit) {
            throw new AccessForbidden('Trial token has exceeded request limit for service');
        }
    }

    async incrementRequests(token: Record<string, any>, serviceName: string) {
        const trial = await this.assertTrial(token);
        await this.requireValidServiceRestriction(trial, token, serviceName);
        const index = trial.serviceRestrictions.findIndex((service: TrialServiceRestriction) => service.serviceName === serviceName);
        trial.serviceRestrictions[index].requestCount++;
        await this.update(token.clientId, trial);
    }

    async create(key: string, value: Trial, expirySeconds: number) {
        const existing = await this.read(key);
        if (existing) {
            throw new Error('Trial data already exists for key');
        }
        await this.redisClient.setex(`${this.trialKeyPrefix}:${key}`, expirySeconds, JSON.stringify(value));
    }

    async read(key: string): Promise<Trial | null> {
        const existing = await this.redisClient.get(`${this.trialKeyPrefix}:${key}`);
        if (existing) {
            return JSON.parse(existing);
        }
        return null;
    }

    async update(key: string, value: Trial) {
        await this.redisClient.set(`${this.trialKeyPrefix}:${key}`, JSON.stringify(value), 'KEEPTTL');
    }

    async delete(key: string): Promise<void> {
        await this.redisClient.del(`${this.trialKeyPrefix}:${key}`);
    }
}
