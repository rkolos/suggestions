import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Client } from 'discord.js';
import { PinoLogger } from 'nestjs-pino';
import { PrismaService } from '../../common/prisma/prisma.service';

interface CommentPublicCreatedPayload {
  companyId: string;
  suggestionId: string;
  comment: {
    id: string;
    body: string;
    author: { username: string };
  };
}

interface SuggestionMergedPayload {
  companyId: string;
  source: { discordThreadId?: string | null };
  target: { id: string; title: string; slug: string };
}

@Injectable()
export class DiscordThreadSyncService {
  constructor(
    private readonly client: Client,
    private readonly prisma: PrismaService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(DiscordThreadSyncService.name);
  }

  private static readonly THREAD_POLL_MS = 2000;
  private static readonly THREAD_POLL_ATTEMPTS = 20;

  @OnEvent('comment.public.created')
  async handleCommentPublicCreated(payload: CommentPublicCreatedPayload): Promise<void> {
    const { companyId, suggestionId, comment } = payload;

    let suggestion: { discordThreadId: string | null } | null = null;
    for (let i = 0; i < DiscordThreadSyncService.THREAD_POLL_ATTEMPTS; i++) {
      suggestion = await this.prisma.suggestion.findFirst({
        where: { id: suggestionId, companyId },
        select: { discordThreadId: true },
      });
      if (suggestion?.discordThreadId) break;
      await new Promise((r) => setTimeout(r, DiscordThreadSyncService.THREAD_POLL_MS));
    }

    if (!suggestion?.discordThreadId) {
      this.logger.info({
        type: 'discord',
        event: 'comment_public_created',
        companyId,
        suggestionId,
        commentId: comment.id,
        result: 'skipped',
        reason: 'discordThreadId not set',
      });
      this.logger.warn(
        { companyId, suggestionId },
        'discordThreadId not set after poll, skipping Discord thread sync',
      );
      return;
    }

    try {
      const threadChannel = await this.client.channels.fetch(suggestion.discordThreadId);
      if (!threadChannel?.isThread?.()) {
        return;
      }
      const text = `**[ОФИЦИАЛЬНЫЙ ОТВЕТ от @${comment.author.username}]**\n${comment.body}`;
      await threadChannel.send({ content: text });
      this.logger.info({
        type: 'discord',
        event: 'comment_public_created',
        companyId,
        suggestionId,
        commentId: comment.id,
        authorUsername: comment.author.username,
        result: 'synced',
        threadId: suggestion.discordThreadId,
      });
    } catch (err) {
      this.logger.warn(
        { err, companyId, suggestionId, threadId: suggestion.discordThreadId },
        'Failed to send public comment to Discord thread',
      );
    }
  }

  @OnEvent('suggestion.merged')
  async handleSuggestionMerged(payload: SuggestionMergedPayload): Promise<void> {
    const { companyId, source, target } = payload;

    if (!source.discordThreadId) {
      this.logger.info({
        type: 'discord',
        event: 'suggestion_merged',
        companyId,
        sourceId: (source as { id?: string }).id,
        targetId: target.id,
        result: 'skipped',
        reason: 'source has no discordThreadId',
      });
      return;
    }

    try {
      const threadChannel = await this.client.channels.fetch(source.discordThreadId);
      if (!threadChannel?.isThread?.()) {
        return;
      }
      const text = `Идея объединена с [${target.title}] (ID: \`${target.id}\`)`;
      await threadChannel.send({ content: text });
      this.logger.info({
        type: 'discord',
        event: 'suggestion_merged',
        companyId,
        sourceId: (source as { id?: string }).id,
        targetId: target.id,
        targetTitle: target.title,
        result: 'notified',
        threadId: source.discordThreadId,
      });
    } catch (err) {
      this.logger.info({
        type: 'discord',
        event: 'suggestion_merged',
        companyId,
        sourceId: (source as { id?: string }).id,
        targetId: target.id,
        result: 'skipped',
        reason: err instanceof Error ? err.message : String(err),
      });
      this.logger.warn(
        { err, companyId, threadId: source.discordThreadId },
        'Failed to send merge notification to Discord thread',
      );
    }
  }
}
