import { Logger } from '@nodescript/logger';
import { Redis } from 'ioredis';
import { config } from 'mesh-config';
import { dep } from 'mesh-ioc';

import { AccessForbidden } from './ac-auth.js';

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

    isTrialToken(token: Record<string, any>) {
        return !!token.serviceRestrictions;
    }

    async requireValidServiceRestriction(token: Record<string, any>, serviceName: string) {
        const serviceRestriction = token.serviceRestrictions.find((s: TokenServiceRestriction) => s.serviceName === serviceName);
        if (!serviceRestriction) {
            throw new AccessForbidden('Service access not configured on token');
        }
        const requestCount = await this.getRequestCount(token.clientId, serviceName);
        if (requestCount >= serviceRestriction.requestLimit) {
            throw new AccessForbidden('Trial token has exceeded request limit for service');
        }
    }

    async incrementRequests(token: Record<string, any>, serviceName: string) {
        const redisKey = this.getServiceKey(token.clientId, serviceName);
        await this.redisClient.hincrby(redisKey, 'requestCount', 1);
    }

    async getRequestCount(clientId: string, serviceName: string) {
        const redisKey = this.getServiceKey(clientId, serviceName);
        const requestCountStr = await this.redisClient.hget(redisKey, 'requestCount');
        if (requestCountStr == null) {
            throw new AccessForbidden('Service access for token not configured');
        }
        return Number(requestCountStr);
    }

    private createRedisClient() {
        return new Redis(this.REDIS_URL, {
            lazyConnect: true,
            disconnectTimeout: 10,
        });
    }

    private getServiceKey(clientId: string, serviceName: string) {
        return `${this.trialKeyPrefix}:${clientId}:${serviceName}`;
    }
}
