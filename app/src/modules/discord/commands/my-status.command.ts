import { Injectable } from '@nestjs/common';
import { Context, SlashCommand, SlashCommandContext } from 'necord';
import { DiscordCompany } from '../decorators/discord-company.decorator';
import { BansService } from '../../moderation/bans.service';
import { SuggestionsService } from '../../suggestions/suggestions.service';
import {
  buildReportChunks,
  DISCORD_CONTENT_MAX_LENGTH,
  type SuggestionForReport,
} from '../my-status-report.util';

const BANNED_MESSAGE = 'You are banned from submitting suggestions and voting on this server.';
const NO_SUGGESTIONS_MESSAGE = 'You have no suggestions yet. Use /suggest to create one.';
const REPORT_HEADER = '**Your suggestions**\n\n';

@Injectable()
export class MyStatusCommand {
  constructor(
    private readonly bansService: BansService,
    private readonly suggestionsService: SuggestionsService,
  ) {}

  @SlashCommand({
    name: 'mystatus',
    description: 'Show status of your suggestions and votes on this server.',
  })
  public async onMyStatus(
    @Context() [interaction]: SlashCommandContext,
    @DiscordCompany() companyId: string,
  ): Promise<void> {
    const userId = interaction.user.id;

    const banned = await this.bansService.isBanned(companyId, userId);
    if (banned) {
      await interaction.reply({
        content: BANNED_MESSAGE,
        ephemeral: true,
      });
      return;
    }

    const { items } = await this.suggestionsService.findAll(
      companyId,
      {
        authorId: userId,
        limit: 50,
        sort: 'createdAt',
        order: 'desc',
      },
      userId,
    );

    if (items.length === 0) {
      await interaction.reply({
        content: NO_SUGGESTIONS_MESSAGE,
        ephemeral: true,
      });
      return;
    }

    const suggestions: SuggestionForReport[] = items.map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status,
      createdAt: s.createdAt,
      upvotes: s.upvotes,
      downvotes: s.downvotes,
      votes: s.votes,
    }));

    const maxContentLength = DISCORD_CONTENT_MAX_LENGTH - REPORT_HEADER.length;
    const chunks = buildReportChunks(suggestions, maxContentLength);

    const firstContent = REPORT_HEADER + chunks[0];
    await interaction.reply({
      content: firstContent,
      ephemeral: true,
    });

    for (let i = 1; i < chunks.length; i++) {
      await interaction.followUp({
        content: chunks[i],
        ephemeral: true,
      });
    }
  }
}
