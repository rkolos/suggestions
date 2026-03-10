import { Injectable } from '@nestjs/common';
import {
  ActionRowBuilder,
  ModalActionRowComponentBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { Ctx, StringSelect } from 'necord';
import type { StringSelectMenuInteraction } from 'discord.js';
import { CompanyConfigService } from '../../config/company-config.service';
import { DISCORD_MESSAGES } from '../discord-messages.constants';

const MODAL_PREFIX = 'suggest_modal';
const MODAL_TITLE = 'New suggestion';
/** Separator for categoryId in modal customId (path-to-regexp style for necord) */
const MODAL_CUSTOM_ID_SEP = '/';

type CategoryOption = { id: string; label: string; color: string };

@Injectable()
export class SuggestCategorySelectHandler {
  constructor(private readonly companyConfigService: CompanyConfigService) {}

  @StringSelect('suggest_category')
  public async onCategorySelect(
    @Ctx() [interaction]: [StringSelectMenuInteraction],
  ): Promise<void> {
    const companyId = (interaction as { companyId?: string }).companyId;
    if (!companyId) {
      await interaction.reply({
        content: DISCORD_MESSAGES.SERVER_NOT_SET_UP,
        ephemeral: true,
      });
      return;
    }

    const categoryId = interaction.values[0];
    if (!categoryId) {
      await interaction.reply({
        content: 'Please select a category.',
        ephemeral: true,
      });
      return;
    }

    const config = await this.companyConfigService.getConfig(companyId);
    const categories = (config.categories as CategoryOption[]).length
      ? (config.categories as CategoryOption[])
      : this.companyConfigService.getDefaultConfig().categories;
    const allowedIds = new Set(categories.map((c) => c.id));
    const resolvedId = allowedIds.has(categoryId) ? categoryId : (categories[0]?.id ?? 'general');

    const modal = new ModalBuilder()
      .setCustomId(`${MODAL_PREFIX}${MODAL_CUSTOM_ID_SEP}${resolvedId}`)
      .setTitle(MODAL_TITLE)
      .addComponents(
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('suggest_title')
            .setLabel('Title')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(100)
            .setPlaceholder('Short title for your idea'),
        ),
        new ActionRowBuilder<ModalActionRowComponentBuilder>().addComponents(
          new TextInputBuilder()
            .setCustomId('suggest_description')
            .setLabel('Description')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(2000)
            .setPlaceholder('Describe your suggestion in detail'),
        ),
      );

    await interaction.showModal(modal);
  }
}
