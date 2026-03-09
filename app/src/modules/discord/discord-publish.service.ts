import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { OnEvent } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { PinoLogger } from 'nestjs-pino';
import { SuggestionStatus } from '@prisma/client';
import { SuggestionStatusChangedPayload } from '../suggestions/events/suggestion-status-changed.event';
import { SuggestionDeletedPayload } from '../suggestions/events/suggestion-deleted.event';

export const DISCORD_PUBLISH_QUEUE = 'discord-publish';

export interface DiscordDeleteJobPayload {
  companyId: string;
  suggestionId: string;
  discordMessageId: string | null;
  discordThreadId: string | null;
}

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
  /** Target suggestion data when merging (status DUPLICATE). */
  mergedInto?: {
    id: string;
    title: string;
    description: string;
    discordMessageId: string | null;
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
      mergedInto: payload.mergedInto,
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

  @OnEvent('suggestion.deleted')
  handleSuggestionDeleted(payload: SuggestionDeletedPayload): void {
    if (!payload.discordMessageId && !payload.discordThreadId) {
      return;
    }

    const jobPayload: DiscordDeleteJobPayload = {
      companyId: payload.companyId,
      suggestionId: payload.suggestionId,
      discordMessageId: payload.discordMessageId ?? null,
      discordThreadId: payload.discordThreadId ?? null,
    };

    this.queue.add('delete', jobPayload).catch((err) => {
      this.logger.error({ err }, 'Failed to add discord delete job to queue');
    });

    this.logger.info({
      type: 'discord',
      event: 'suggestion_deleted',
      suggestionId: payload.suggestionId,
      result: 'queued',
      queue: 'discord-publish',
    });
  }
}
