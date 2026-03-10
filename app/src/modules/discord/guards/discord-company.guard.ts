import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { NecordExecutionContext } from 'necord';
import type { Interaction } from 'discord.js';
import { CompanyConfigService } from '../../config/company-config.service';
import { DISCORD_MESSAGES } from '../discord-messages.constants';

export type InteractionWithCompany = Interaction & { companyId?: string };

@Injectable()
export class DiscordCompanyGuard implements CanActivate {
  constructor(private readonly companyConfigService: CompanyConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if ((context.getType() as string) !== 'necord') {
      return true;
    }

    const necordContext = NecordExecutionContext.create(context);
    const discovery = necordContext.getDiscovery();

    if (
      !discovery ||
      (!discovery.isSlashCommand() && !discovery.isModal() && !discovery.isMessageComponent())
    ) {
      return true;
    }

    const [interaction] = necordContext.getContext<[Interaction]>() ?? [];
    if (!interaction) {
      return true;
    }

    const guildId = interaction.guildId ?? interaction.guild?.id;
    if (!guildId) {
      if (interaction.isRepliable()) {
        await interaction.reply({
          content: DISCORD_MESSAGES.DM_ONLY_SERVERS,
          ephemeral: true,
        });
      }
      return false;
    }

    const config = await this.companyConfigService.findByDiscordGuildId(guildId);
    if (!config) {
      if (interaction.isRepliable()) {
        await interaction.reply({
          content: DISCORD_MESSAGES.SERVER_NOT_SET_UP,
          ephemeral: true,
        });
      }
      return false;
    }

    (interaction as InteractionWithCompany).companyId = config.companyId;
    return true;
  }
}
