import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { SuggestionStatus } from '@prisma/client';
import { SuggestionStatusChangedPayload } from '../suggestions/events/suggestion-status-changed.event';

export const DISCORD_PUBLISH_QUEUE = 'discord-publish';

export interface DiscordPublishJobPayload {
  companyId: string;
  suggestionId: string;
  oldStatus: SuggestionStatus;
  newStatus: SuggestionStatus;
  suggestion: {
    id: string;
    companyId: string;
    authorId: string;
    title: string;
    description: string;
    category: string;
    status: SuggestionStatus;
    discordMessageId?: string | null;
    discordThreadId?: string | null;
    mergedIntoId?: string | null;
    author?: { username: string; avatarUrl: string | null };
  };
}

@Injectable()
export class DiscordPublishService {
  constructor(
    @InjectQueue(DISCORD_PUBLISH_QUEUE) private readonly queue: Queue,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(DiscordPublishService.name);
  }

  @OnEvent('suggestion.status.changed')
  handleStatusChanged(payload: SuggestionStatusChangedPayload): void {
    if (payload.newStatus === SuggestionStatus.NEW) {
      return;
    }

    const jobPayload: DiscordPublishJobPayload = {
      companyId: payload.companyId,
      suggestionId: payload.suggestionId,
      oldStatus: payload.oldStatus,
      newStatus: payload.newStatus,
      suggestion: {
        id: payload.suggestion.id,
        companyId: payload.suggestion.companyId,
        authorId: payload.suggestion.authorId,
        title: payload.suggestion.title,
        description: payload.suggestion.description,
        category: payload.suggestion.category,
        status: payload.suggestion.status,
        discordMessageId: payload.suggestion.discordMessageId,
        discordThreadId: payload.suggestion.discordThreadId,
        mergedIntoId: payload.suggestion.mergedIntoId,
        author: payload.suggestion.author,
      },
    };

    this.queue.add('publish', jobPayload).catch((err) => {
      this.logger.error({ err }, 'Failed to add discord publish job to queue');
    });

    this.logger.info({
      type: 'discord',
      event: 'suggestion_status_changed',
      suggestionId: payload.suggestionId,
      oldStatus: payload.oldStatus,
      newStatus: payload.newStatus,
      result: 'queued',
      queue: 'discord-publish',
    });
  }
}
