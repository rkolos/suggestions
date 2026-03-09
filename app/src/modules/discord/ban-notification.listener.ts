import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Client } from 'discord.js';
import { PinoLogger } from 'nestjs-pino';
import { CompanyConfigService } from '../config/company-config.service';

export interface BanUnbanPayload {
  companyId: string;
  userId: string;
}

@Injectable()
export class BanNotificationListener {
  constructor(
    private readonly client: Client,
    private readonly companyConfigService: CompanyConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(BanNotificationListener.name);
  }

  @OnEvent('user.banned')
  async handleUserBanned(payload: BanUnbanPayload): Promise<void> {
    await this.sendBanUnbanDm(payload, 'banned');
  }

  @OnEvent('user.unbanned')
  async handleUserUnbanned(payload: BanUnbanPayload): Promise<void> {
    await this.sendBanUnbanDm(payload, 'unbanned');
  }

  private async sendBanUnbanDm(
    payload: BanUnbanPayload,
    kind: 'banned' | 'unbanned',
  ): Promise<void> {
    const { companyId, userId } = payload;
    let guildName: string | null = null;
    try {
      const config = await this.companyConfigService.getConfig(companyId);
      if (config.discordGuildId) {
        const guild = await this.client.guilds.fetch(config.discordGuildId);
        guildName = guild.name;
      }
    } catch {
      // use null guildName
    }

    const guildPart = guildName != null ? ` for server **${guildName}**` : '';
    const text =
      kind === 'banned'
        ? `You have been banned from the Suggestions bot${guildPart}. You can no longer submit suggestions or vote.`
        : `You have been unbanned from the Suggestions bot${guildPart}. You can submit suggestions and vote again.`;

    try {
      const user = await this.client.users.fetch(userId);
      await user.send({ content: text });
    } catch (dmErr) {
      this.logger.warn(
        {
          err: dmErr,
          companyId,
          userId,
          kind,
        },
        'Failed to send ban/unban notification DM to user',
      );
    }
  }
}
