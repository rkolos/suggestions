import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { AI_SYNC_QUEUE, AiSyncJobPayload } from './ai-integration.service';

@Processor(AI_SYNC_QUEUE)
@Injectable()
export class AiSyncProcessor extends WorkerHost {
  constructor(
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    super();
    this.logger.setContext(AiSyncProcessor.name);
  }

  async process(job: Job<AiSyncJobPayload>): Promise<void> {
    const { suggestionId, companyId, title, description, status } = job.data;
    const baseUrl = this.configService.get<string>('AI_SERVICE_URL')?.trim();

    if (!baseUrl) {
      this.logger.warn({ suggestionId }, 'AI_SERVICE_URL not configured, skipping RAG sync');
      return;
    }

    const url = `${baseUrl.replace(/\/$/, '')}/rag/sync`;
    const body = JSON.stringify({
      suggestionId,
      companyId,
      title,
      description,
      status,
    });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body,
      });

      if (!response.ok) {
        this.logger.warn(
          { suggestionId, status: response.status, statusText: response.statusText },
          'AI service returned non-OK response for RAG sync',
        );
      }
    } catch (err) {
      this.logger.error({ err, suggestionId, url }, 'AI service request failed during RAG sync');
    }
  }
}
