import { Injectable } from '@nestjs/common';
import type { InteractionResponse } from 'discord.js';
import { Ctx, Modal, ModalContext, ModalParam } from 'necord';
import { PinoLogger } from 'nestjs-pino';
import { appendDiscordBlockSync } from '../../../common/dev-log/dev-debug-log.stream';
import { DiscordCompany } from '../decorators/discord-company.decorator';
import { CompanyConfigService } from '../../config/company-config.service';
import { SuggestionsService } from '../../suggestions/suggestions.service';
import { UsersService } from '../../users/users.service';
import { formatSuggestionLine, MY_STATUS_HINT } from '../my-status-report.util';

type CategoryOption = { id: string; label: string; color: string };

@Injectable()
export class SuggestModalHandler {
  constructor(
    private readonly suggestionsService: SuggestionsService,
    private readonly usersService: UsersService,
    private readonly companyConfigService: CompanyConfigService,
    private readonly logger: PinoLogger,
  ) {}

  @Modal('suggest_modal/:categoryId')
  public async onModalSubmit(
    @Ctx() [interaction]: ModalContext,
    @DiscordCompany() companyId: string,
    @ModalParam('categoryId') categoryId: string,
  ): Promise<InteractionResponse> {
    const title = interaction.fields.getTextInputValue('suggest_title');
    const description = interaction.fields.getTextInputValue('suggest_description');
    const userId = interaction.user.id;

    this.usersService.syncProfile(userId).catch(() => {});

    const config = await this.companyConfigService.getConfig(companyId);
    const categories = (config.categories as CategoryOption[]).length
      ? (config.categories as CategoryOption[])
      : this.companyConfigService.getDefaultConfig().categories;
    const category = categories.find((c) => c.id === categoryId) ?? categories[0];
    const categoryLabel = category?.label ?? 'General';

    const suggestion = await this.suggestionsService.create(companyId, userId, {
      title,
      description,
      category: categoryLabel,
      source: 'DISCORD',
    });

    const discordLog = {
      event: 'suggest_modal_submit',
      companyId,
      userId,
      title,
      description,
      result: 'created',
      suggestion: {
        id: suggestion.id,
        title: suggestion.title,
        slug: suggestion.slug,
        status: suggestion.status,
        source: suggestion.source,
        authorId: suggestion.authorId,
        category: suggestion.category,
        createdAt: suggestion.createdAt,
      },
    };
    this.logger.info({ type: 'discord', ...discordLog });
    appendDiscordBlockSync(discordLog);

    const reportLine = formatSuggestionLine({
      id: suggestion.id,
      title: suggestion.title,
      status: suggestion.status,
      createdAt: suggestion.createdAt,
      upvotes: 0,
      downvotes: 0,
    });
    const content = `${reportLine}\n\n${MY_STATUS_HINT}`;

    return interaction.reply({
      content,
      ephemeral: true,
    });
  }
}
