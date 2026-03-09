import { Injectable } from '@nestjs/common';
import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { Context, SlashCommand, SlashCommandContext } from 'necord';
import { appendDiscordBlockSync } from '../../../common/dev-log/dev-debug-log.stream';
import { DiscordCompany } from '../decorators/discord-company.decorator';
import { CompanyConfigService } from '../../config/company-config.service';

const SELECT_MENU_CUSTOM_ID = 'suggest_category';
const CATEGORY_SELECT_MESSAGE =
  'Select a category — then the form for title and description will open. New suggestions are under moderation and will appear in the channel after admin approval.';

type CategoryOption = { id: string; label: string; color: string };

@Injectable()
export class SuggestCommand {
  constructor(private readonly companyConfigService: CompanyConfigService) {}

  @SlashCommand({
    name: 'suggest',
    description: 'Submit a suggestion',
  })
  public async onSuggest(
    @Context() [interaction]: SlashCommandContext,
    @DiscordCompany() companyId: string,
  ): Promise<void> {
    appendDiscordBlockSync({
      event: 'suggest_command',
      result: 'category_select_shown',
      userId: interaction.user.id,
      guildId: interaction.guildId ?? undefined,
    });

    const config = await this.companyConfigService.getConfig(companyId);
    const categories = (config.categories as CategoryOption[]).length
      ? (config.categories as CategoryOption[])
      : this.companyConfigService.getDefaultConfig().categories;

    const options = categories
      .slice(0, 25)
      .map((cat) => new StringSelectMenuOptionBuilder().setLabel(cat.label).setValue(cat.id));

    const select = new StringSelectMenuBuilder()
      .setCustomId(SELECT_MENU_CUSTOM_ID)
      .setPlaceholder('Category')
      .addOptions(options);

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);

    await interaction.reply({
      content: CATEGORY_SELECT_MESSAGE,
      components: [row],
      ephemeral: true,
    });
  }
}
