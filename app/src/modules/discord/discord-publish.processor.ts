import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { PinoLogger } from 'nestjs-pino';
import { SuggestionStatus } from '@prisma/client';
import { CompanyConfigService } from '../config/company-config.service';
import { SuggestionsService } from '../suggestions/suggestions.service';
import { VotesService } from '../votes/votes.service';
import { DISCORD_PUBLISH_QUEUE, DiscordPublishJobPayload } from './discord-publish.service';
import {
  getNotificationTemplateKey,
  renderNotificationTemplate,
} from './notification-template.util';
import { buildVoteButtons } from './vote-buttons.util';

const EMBED_DESCRIPTION_MAX_LENGTH = 4000;

const STATUS_COLORS: Record<SuggestionStatus, number> = {
  [SuggestionStatus.NEW]: 0x95a5a6,
  [SuggestionStatus.OPEN]: 0xfee75c,
  [SuggestionStatus.IN_PROGRESS]: 0x5865f2,
  [SuggestionStatus.COMPLETED]: 0x57f287,
  [SuggestionStatus.DUPLICATE]: 0x747f8d,
  [SuggestionStatus.REJECTED]: 0xed4245,
  [SuggestionStatus.PLANNED]: 0xeb459e,
};

const STATUS_LABELS: Record<SuggestionStatus, string> = {
  [SuggestionStatus.NEW]: 'Under review',
  [SuggestionStatus.OPEN]: 'Open for voting',
  [SuggestionStatus.IN_PROGRESS]: 'In progress',
  [SuggestionStatus.COMPLETED]: 'Completed',
  [SuggestionStatus.DUPLICATE]: 'Duplicate',
  [SuggestionStatus.REJECTED]: 'Rejected',
  [SuggestionStatus.PLANNED]: 'Planned',
};

const VOTABLE_STATUSES: SuggestionStatus[] = [
  SuggestionStatus.OPEN,
  SuggestionStatus.PLANNED,
  SuggestionStatus.IN_PROGRESS,
];

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

  async process(job: Job<DiscordPublishJobPayload>): Promise<void> {
    const { companyId, suggestionId, suggestion, newStatus } = job.data;

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
      const embed = this.buildEmbed(suggestion);

      const showVoteButtons = VOTABLE_STATUSES.includes(newStatus);
      const { upvotes, downvotes } = showVoteButtons
        ? await this.votesService.getVoteCounts(suggestionId)
        : { upvotes: 0, downvotes: 0 };
      const components = showVoteButtons ? buildVoteButtons(suggestionId, upvotes, downvotes) : [];

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
      await this.sendStatusChangeNotifications(companyId, job.data, threadId, config);

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
        companyId: job.data.companyId,
        suggestionId: job.data.suggestionId,
        newStatus: job.data.newStatus,
        result: 'skipped',
        reason: err instanceof Error ? err.message : String(err),
      });
      this.logger.error(
        { err, companyId: job.data.companyId, suggestionId: job.data.suggestionId },
        'Discord API error during publish/update',
      );
    }
  }

  private buildEmbed(suggestion: DiscordPublishJobPayload['suggestion']): EmbedBuilder {
    const description =
      suggestion.description.length > EMBED_DESCRIPTION_MAX_LENGTH
        ? suggestion.description.slice(0, EMBED_DESCRIPTION_MAX_LENGTH - 3) + '...'
        : suggestion.description;

    const embed = new EmbedBuilder()
      .setTitle(suggestion.title)
      .setDescription(description)
      .setColor(STATUS_COLORS[suggestion.status] ?? 0x95a5a6)
      .setFooter({ text: STATUS_LABELS[suggestion.status] ?? suggestion.status })
      .setTimestamp();

    if (suggestion.author) {
      embed.setAuthor({
        name: suggestion.author.username,
        iconURL: suggestion.author.avatarUrl ?? undefined,
      });
    }

    if (suggestion.status === SuggestionStatus.DUPLICATE && suggestion.mergedIntoId) {
      embed.addFields({
        name: 'Original',
        value: `Merged into suggestion \`${suggestion.mergedIntoId}\``,
      });
    }

    return embed;
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
