import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { Client, TextChannel } from 'discord.js';
import { PinoLogger } from 'nestjs-pino';
import { SuggestionStatus } from '@prisma/client';
import { CompanyConfigService } from '../config/company-config.service';
import { SuggestionsService } from '../suggestions/suggestions.service';
import { VotesService } from '../votes/votes.service';
import {
  DISCORD_PUBLISH_QUEUE,
  DiscordDeleteJobPayload,
  DiscordPublishJobPayload,
} from './discord-publish.service';
import {
  getNotificationTemplateKey,
  renderNotificationTemplate,
} from './notification-template.util';
import { buildSuggestionEmbed } from './suggestion-embed.util';
import { buildVoteButtons } from './vote-buttons.util';

const SUGGESTION_DELETED_MESSAGE = 'Suggestion deleted';

@Processor(DISCORD_PUBLISH_QUEUE)
@Injectable()
export class DiscordPublishProcessor extends WorkerHost {
  constructor(
    private readonly client: Client,
    private readonly companyConfigService: CompanyConfigService,
    private readonly suggestionsService: SuggestionsService,
    private readonly votesService: VotesService,
    private readonly logger: PinoLogger,
  ) {
    super();
    this.logger.setContext(DiscordPublishProcessor.name);
  }

  async process(job: Job<DiscordPublishJobPayload | DiscordDeleteJobPayload>): Promise<void> {
    if (job.name === 'delete') {
      await this.processDelete(job as Job<DiscordDeleteJobPayload>);
      return;
    }

    const { companyId, suggestionId, suggestion, newStatus, mergedInto } =
      job.data as DiscordPublishJobPayload;

    try {
      const config = await this.companyConfigService.getConfig(companyId);
      if (!config.suggestionsChannelId) {
        this.logger.info({
          type: 'discord',
          event: 'discord_publish_job',
          companyId,
          suggestionId,
          newStatus,
          result: 'skipped',
          reason: 'suggestionsChannelId not configured',
        });
        this.logger.warn(
          { companyId, suggestionId },
          'suggestionsChannelId not configured, skipping publish',
        );
        return;
      }

      const channel = await this.client.channels.fetch(config.suggestionsChannelId);
      if (!channel || !channel.isTextBased()) {
        this.logger.info({
          type: 'discord',
          event: 'discord_publish_job',
          companyId,
          suggestionId,
          newStatus,
          result: 'skipped',
          reason: 'Channel not found or not text-based',
          channelId: config.suggestionsChannelId,
        });
        this.logger.warn(
          { channelId: config.suggestionsChannelId },
          'Channel not found or not text-based',
        );
        return;
      }

      const textChannel = channel as TextChannel;

      const isOpen = newStatus === SuggestionStatus.OPEN;
      const isNew = newStatus === SuggestionStatus.NEW;
      let upvotes = 0;
      let downvotes = 0;
      if (isOpen) {
        const counts = await this.votesService.getVoteCounts(suggestionId);
        upvotes = counts.upvotes;
        downvotes = counts.downvotes;
      } else if (!isNew) {
        const counts = await this.votesService.getVoteCounts(suggestionId);
        upvotes = counts.upvotes;
        downvotes = counts.downvotes;
      }

      const guildId = config.discordGuildId;
      const channelId = config.suggestionsChannelId;
      const mergedIntoMessageUrl =
        suggestion.status === SuggestionStatus.DUPLICATE &&
        mergedInto?.discordMessageId &&
        guildId &&
        channelId
          ? `https://discord.com/channels/${guildId}/${channelId}/${mergedInto.discordMessageId}`
          : undefined;
      const embedInput = { ...suggestion, mergedIntoMessageUrl };
      const embed = buildSuggestionEmbed(embedInput);
      if (!isOpen) {
        if (isNew) {
          embed.addFields({
            name: 'Voting',
            value: 'Voting is not available in this status.',
          });
        } else {
          const total = upvotes + downvotes;
          embed.addFields({
            name: 'Voting (closed)',
            value: `Total: ${total} | 👍 ${upvotes} | 👎 ${downvotes}`,
          });
        }
      }

      const components = isOpen ? buildVoteButtons(suggestionId, upvotes, downvotes) : [];

      let effectiveThreadId: string | null = suggestion.discordThreadId ?? null;
      let messageId: string | null = null;
      let threadCreated = false;

      if (suggestion.discordMessageId) {
        const message = await textChannel.messages.fetch(suggestion.discordMessageId);
        await message.edit({
          embeds: [embed],
          components,
        });
        messageId = message.id;
      } else {
        const message = await textChannel.send({ embeds: [embed], components });
        messageId = message.id;
        try {
          const thread = await message.startThread({
            name: suggestion.title.substring(0, 100),
            autoArchiveDuration: 1440,
            reason: 'Discussion for this suggestion',
          });
          effectiveThreadId = thread.id;
          threadCreated = true;
        } catch (threadErr) {
          this.logger.warn(
            { err: threadErr, companyId, suggestionId },
            'Failed to create Discord thread',
          );
        }
        await this.suggestionsService.updateDiscordIds(companyId, suggestionId, {
          discordMessageId: message.id,
          ...(effectiveThreadId && { discordThreadId: effectiveThreadId }),
        });
      }

      const threadId = effectiveThreadId;
      await this.sendStatusChangeNotifications(
        companyId,
        job.data as DiscordPublishJobPayload,
        threadId,
        config,
      );

      if (threadId) {
        try {
          const threadChannel = await this.client.channels.fetch(threadId);
          if (threadChannel?.isThread?.()) {
            const TERMINAL_STATUSES: SuggestionStatus[] = [
              SuggestionStatus.COMPLETED,
              SuggestionStatus.REJECTED,
              SuggestionStatus.DUPLICATE,
            ];
            if (TERMINAL_STATUSES.includes(newStatus)) {
              await threadChannel.setLocked(true, 'Suggestion closed or completed');
              await threadChannel.setArchived(true);
            } else if (
              newStatus === SuggestionStatus.OPEN ||
              newStatus === SuggestionStatus.IN_PROGRESS
            ) {
              await threadChannel.setLocked(false);
            }
          }
        } catch (threadErr) {
          this.logger.warn(
            { err: threadErr, companyId, suggestionId, threadId },
            'Failed to lock/unlock Discord thread',
          );
        }
      }

      this.logger.info({
        type: 'discord',
        event: 'discord_publish_job',
        companyId,
        suggestionId,
        newStatus,
        result: 'sent',
        channelId: config.suggestionsChannelId,
        messageId,
        threadCreated,
        threadId: effectiveThreadId,
      });
    } catch (err) {
      this.logger.info({
        type: 'discord',
        event: 'discord_publish_job',
        companyId: (job.data as DiscordPublishJobPayload).companyId,
        suggestionId: (job.data as DiscordPublishJobPayload).suggestionId,
        newStatus: (job.data as DiscordPublishJobPayload).newStatus,
        result: 'skipped',
        reason: err instanceof Error ? err.message : String(err),
      });
      this.logger.error(
        {
          err,
          companyId: (job.data as DiscordPublishJobPayload).companyId,
          suggestionId: (job.data as DiscordPublishJobPayload).suggestionId,
        },
        'Discord API error during publish/update',
      );
    }
  }

  private async processDelete(job: Job<DiscordDeleteJobPayload>): Promise<void> {
    const { companyId, suggestionId, discordMessageId, discordThreadId } = job.data;

    try {
      const config = await this.companyConfigService.getConfig(companyId);
      if (!config.suggestionsChannelId) {
        this.logger.info({
          type: 'discord',
          event: 'discord_delete_job',
          companyId,
          suggestionId,
          result: 'skipped',
          reason: 'suggestionsChannelId not configured',
        });
        return;
      }

      const channel = await this.client.channels.fetch(config.suggestionsChannelId);
      if (!channel || !channel.isTextBased()) {
        this.logger.info({
          type: 'discord',
          event: 'discord_delete_job',
          companyId,
          suggestionId,
          result: 'skipped',
          reason: 'Channel not found or not text-based',
          channelId: config.suggestionsChannelId,
        });
        return;
      }

      const textChannel = channel as TextChannel;

      if (discordThreadId) {
        try {
          const threadChannel = await this.client.channels.fetch(discordThreadId);
          if (threadChannel?.isThread?.()) {
            await threadChannel.send({ content: SUGGESTION_DELETED_MESSAGE });
          }
        } catch (threadErr) {
          this.logger.warn(
            { err: threadErr, companyId, suggestionId, threadId: discordThreadId },
            'Failed to send "Suggestion deleted" to Discord thread',
          );
        }
      }

      if (discordMessageId) {
        try {
          const message = await textChannel.messages.fetch(discordMessageId);
          await message.delete();
        } catch (messageErr) {
          this.logger.warn(
            { err: messageErr, companyId, suggestionId, messageId: discordMessageId },
            'Failed to delete Discord message',
          );
        }
      }

      this.logger.info({
        type: 'discord',
        event: 'discord_delete_job',
        companyId,
        suggestionId,
        result: 'ok',
      });
    } catch (err) {
      this.logger.info({
        type: 'discord',
        event: 'discord_delete_job',
        companyId,
        suggestionId: job.data.suggestionId,
        result: 'skipped',
        reason: err instanceof Error ? err.message : String(err),
      });
      this.logger.error(
        { err, companyId, suggestionId: job.data.suggestionId },
        'Discord API error during delete',
      );
    }
  }

  private async sendStatusChangeNotifications(
    companyId: string,
    jobData: DiscordPublishJobPayload,
    threadId: string | null,
    config: { discordGuildId: string | null; suggestionsChannelId: string | null },
  ): Promise<void> {
    const { suggestion, newStatus, mergedInto } = jobData;
    const templateKey = getNotificationTemplateKey(newStatus, mergedInto);
    if (!templateKey) return;

    const templates = await this.companyConfigService.getNotifications(companyId);
    const template = templates[templateKey]?.trim();
    if (!template) return;

    const vars: Record<string, string> = {
      user: suggestion.author?.username ?? '',
      id: suggestion.id,
      title: suggestion.title,
    };
    if (mergedInto) {
      vars.targetTitle = mergedInto.title;
      vars.targetDescription = mergedInto.description;
      const guildId = config.discordGuildId;
      const channelId = config.suggestionsChannelId;
      const messageId = mergedInto.discordMessageId;
      vars.targetUrl =
        guildId && channelId && messageId
          ? `https://discord.com/channels/${guildId}/${channelId}/${messageId}`
          : '';
    }
    const text = renderNotificationTemplate(template, vars);
    if (!text.trim()) return;

    try {
      const user = await this.client.users.fetch(suggestion.authorId);
      await user.send({ content: text });
    } catch (dmErr) {
      this.logger.warn(
        {
          err: dmErr,
          companyId,
          suggestionId: jobData.suggestionId,
          authorId: suggestion.authorId,
        },
        'Failed to send notification DM to author',
      );
    }

    if (threadId) {
      try {
        const threadChannel = await this.client.channels.fetch(threadId);
        if (threadChannel?.isThread?.()) {
          await threadChannel.send({ content: text });
        }
      } catch (threadErr) {
        this.logger.warn(
          { err: threadErr, companyId, suggestionId: jobData.suggestionId, threadId },
          'Failed to send notification to Discord thread',
        );
      }
    }
  }
}
