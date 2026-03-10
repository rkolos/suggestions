import { Injectable, NotFoundException } from '@nestjs/common';
import { PermissionFlagsBits } from 'discord.js';
import { Context, Options, SlashCommand, SlashCommandContext, StringOption } from 'necord';
import { SuggestionStatus } from '@prisma/client';
import { DiscordCompany } from '../decorators/discord-company.decorator';
import { SuggestionsService } from '../../suggestions/suggestions.service';

const APPROVE_SUCCESS_MESSAGE = 'Suggestion approved.';
const REJECT_SUCCESS_MESSAGE = 'Suggestion rejected.';
const SUGGESTION_NOT_FOUND_MESSAGE = 'Suggestion not found.';
const PROVIDE_ID_OR_THREAD_MESSAGE =
  'Provide a suggestion ID or use this command inside a suggestion thread.';

const MODERATOR_PERMISSIONS = PermissionFlagsBits.ManageGuild;

class SuggestionIdOptionsDto {
  @StringOption({
    name: 'suggestion_id',
    description: 'Suggestion ID (optional if used inside the suggestion thread)',
    required: false,
  })
  suggestion_id?: string;
}

@Injectable()
export class AdminSuggestionsCommand {
  constructor(private readonly suggestionsService: SuggestionsService) {}

  private async resolveSuggestionId(
    companyId: string,
    interaction: { channel?: { id: string; isThread?: () => boolean } | null },
    suggestionIdOption: string | undefined,
  ): Promise<string> {
    if (suggestionIdOption?.trim()) {
      await this.suggestionsService.findById(companyId, suggestionIdOption.trim());
      return suggestionIdOption.trim();
    }
    if (interaction.channel?.isThread?.()) {
      const suggestion = await this.suggestionsService.findByDiscordThreadId(
        companyId,
        interaction.channel.id,
      );
      return suggestion.id;
    }
    throw new NotFoundException(PROVIDE_ID_OR_THREAD_MESSAGE);
  }

  @SlashCommand({
    name: 'approve',
    description:
      'Approve a suggestion (publish to channel). Use in thread or provide suggestion ID.',
    defaultMemberPermissions: MODERATOR_PERMISSIONS,
    dmPermission: false,
  })
  public async onApprove(
    @Context() [interaction]: SlashCommandContext,
    @DiscordCompany() companyId: string,
    @Options() { suggestion_id }: SuggestionIdOptionsDto,
  ): Promise<void> {
    try {
      const id = await this.resolveSuggestionId(companyId, interaction, suggestion_id);
      await this.suggestionsService.updateStatus(companyId, id, SuggestionStatus.OPEN);
      await interaction.reply({ content: APPROVE_SUCCESS_MESSAGE, ephemeral: true });
    } catch (e) {
      if (e instanceof NotFoundException) {
        const message =
          e.message === PROVIDE_ID_OR_THREAD_MESSAGE ? e.message : SUGGESTION_NOT_FOUND_MESSAGE;
        await interaction.reply({ content: message, ephemeral: true });
        return;
      }
      throw e;
    }
  }

  @SlashCommand({
    name: 'reject',
    description: 'Reject a suggestion. Use in thread or provide suggestion ID.',
    defaultMemberPermissions: MODERATOR_PERMISSIONS,
    dmPermission: false,
  })
  public async onReject(
    @Context() [interaction]: SlashCommandContext,
    @DiscordCompany() companyId: string,
    @Options() { suggestion_id }: SuggestionIdOptionsDto,
  ): Promise<void> {
    try {
      const id = await this.resolveSuggestionId(companyId, interaction, suggestion_id);
      await this.suggestionsService.updateStatus(companyId, id, SuggestionStatus.REJECTED);
      await interaction.reply({ content: REJECT_SUCCESS_MESSAGE, ephemeral: true });
    } catch (e) {
      if (e instanceof NotFoundException) {
        const message =
          e.message === PROVIDE_ID_OR_THREAD_MESSAGE ? e.message : SUGGESTION_NOT_FOUND_MESSAGE;
        await interaction.reply({ content: message, ephemeral: true });
        return;
      }
      throw e;
    }
  }
}
