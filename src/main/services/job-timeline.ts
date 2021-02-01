import { injectable, inject } from 'inversify';
import { Logger } from '../logger';
import { Request, BasicAuthAgent } from '@automationcloud/request';
import { FrameworkEnv } from '../env';
import { Exception } from '../exception';

export interface JobTimelineEvent {
    namespace: string;
    type: string;
    level?: 'critical' | 'warning' | 'info' | 'debug';
    timestamp: number;
    jobId: string;
    executionId?: string | null;
    initiator?: {
        type: string;
        id: string;
        name: string;
        details?: object;
    };
    details: object;
}

export abstract class JobTimelineService {
    abstract add(timelineEvent: JobTimelineEvent): void;
    abstract start(): Promise<void>;
    abstract stop(): Promise<void>;
}

@injectable()
export class JobTimelineServiceMock extends JobTimelineService {
    started: boolean = false;
    events: JobTimelineEvent[] = [];

    add(timelineEvent: JobTimelineEvent) {
        this.events.push(timelineEvent);
    }

    async start() {
        this.started = true;
    }

    async stop() {
        this.started = false;
    }
}

@injectable()
export class ApiJobTimelineService extends JobTimelineService {
    private request: Request;

    private buffer: JobTimelineEvent[] = [];
    private bufferSize: number = 30;
    private bufferTtl: number = 3000;
    private bufferFlushedAt: number = Date.now();

    private autoFlushActive: boolean = false;
    private autoFlushPromise: Promise<void> | null = null;

    constructor(
        @inject(Logger)
        protected logger: Logger,
        @inject(FrameworkEnv)
        protected env: FrameworkEnv,
    ) {
        super();
        const baseUrl = this.env.API_JOB_TIMELINE_URL;
        const authKey = this.env.API_JOB_TIMELINE_KEY;
        if (!baseUrl || !authKey) {
            throw new Exception('Check Environment: API_JOB_TIMELINE_URL, API_JOB_TIMELINE_KEY');
        }

        // subject to change the auth afterwards?
        const auth = new BasicAuthAgent({ username: authKey });
        this.request = new Request({ baseUrl, auth });
    }

    add(timelineEvent: JobTimelineEvent) {
        this.buffer.push(timelineEvent);
        this.flushIfNeeded();
    }

    async start() {
        this.autoFlushActive = true;
        this.autoFlushPromise = this.autoFlushLoop();
    }

    async stop() {
        this.autoFlushActive = false;
        await this.autoFlushPromise;
        await this.flush();
    }

    private async autoFlushLoop() {
        while (this.autoFlushActive) {
            await this.flushIfNeeded();
            await new Promise(r => setTimeout(r, this.bufferTtl));
        }
    }

    private async flushIfNeeded() {
        const full = this.buffer.length >= this.bufferSize;
        const timeout = Date.now() > this.bufferFlushedAt + this.bufferTtl;

        if (full || timeout) {
            await this.flush();
        }
    }

    private async flush() {
        const events = this.buffer;
        this.buffer = [];
        this.bufferFlushedAt = Date.now();
        if (!events.length) {
            return;
        }
        try {
            await this.send(events);
        } catch (error) {
            this.logger.warn('Failed to flush job timeline events', {
                error,
                events,
            });
        }
    }

    private async send(events: JobTimelineEvent[]) {
        await this.request.post('/private/timeline/events', {
            body: events
        });
    }

}
