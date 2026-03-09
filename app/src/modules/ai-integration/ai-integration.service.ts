import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { SuggestionStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';

export const AI_SYNC_QUEUE = 'ai-sync';

export interface AiSyncJobPayload {
  suggestionId: string;
  companyId: string;
  title: string;
  description: string;
  status: SuggestionStatus;
}

type SuggestionWithRelations = Prisma.SuggestionGetPayload<{
  include: { author: true; votes: true };
}>;

@Injectable()
export class AiIntegrationService {
  constructor(
    @InjectQueue(AI_SYNC_QUEUE) private readonly queue: Queue,
    private readonly configService: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(AiIntegrationService.name);
  }

  private toPayload(suggestion: SuggestionWithRelations): AiSyncJobPayload {
    return {
      suggestionId: suggestion.id,
      companyId: suggestion.companyId,
      title: suggestion.title,
      description: suggestion.description,
      status: suggestion.status,
    };
  }

  private enqueue(payload: AiSyncJobPayload): void {
    const aiServiceUrl = this.configService.get<string>('AI_SERVICE_URL')?.trim();
    if (!aiServiceUrl) {
      this.logger.warn(
        { suggestionId: payload.suggestionId },
        'AI_SERVICE_URL not configured, skipping RAG sync',
      );
      return;
    }

    this.queue.add('sync', payload).catch((err) => {
      this.logger.error(
        { err, suggestionId: payload.suggestionId },
        'Failed to add AI sync job to queue',
      );
    });
  }

  @OnEvent('suggestion.created')
  handleCreated(suggestion: SuggestionWithRelations): void {
    this.enqueue(this.toPayload(suggestion));
  }

  @OnEvent('suggestion.updated')
  handleUpdated(suggestion: SuggestionWithRelations): void {
    this.enqueue(this.toPayload(suggestion));
  }

  /**
   * Синхронный поиск похожих предложений по тексту (RAG search).
   * При ошибке AI-сервиса возвращает пустой массив (Graceful Degradation).
   */
  async findSimilar(companyId: string, text: string): Promise<string[]> {
    const baseUrl = this.configService.get<string>('AI_SERVICE_URL')?.trim();
    if (!baseUrl) {
      this.logger.warn('AI_SERVICE_URL not configured, returning empty similar results');
      return [];
    }

    const url = `${baseUrl.replace(/\/$/, '')}/rag/search`;
    const body = JSON.stringify({ companyId, text });

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });

      if (!response.ok) {
        this.logger.error(
          { status: response.status, statusText: response.statusText, companyId },
          'AI service returned non-OK response for RAG search',
        );
        return [];
      }

      const data = (await response.json()) as { ids?: string[] } | string[];
      const ids = Array.isArray(data) ? data : (data.ids ?? []);
      return Array.isArray(ids) ? ids : [];
    } catch (err) {
      this.logger.error({ err, companyId, url }, 'AI service request failed during RAG search');
      return [];
    }
  }
}
