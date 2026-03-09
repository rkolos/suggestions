import { Injectable } from '@nestjs/common';
import { Client } from 'discord.js';
import { PinoLogger } from 'nestjs-pino';
import { PrismaService } from '../../common/prisma/prisma.service';

const SYNC_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export interface MeResponse {
  id: string;
  username?: string;
  avatar_url?: string;
  role?: string;
  permissions?: {
    canManageSuggestionsConfig?: boolean;
    canPostOfficialProposal?: boolean;
    canBanUsers?: boolean;
  };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly client: Client,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(UsersService.name);
  }

  async syncProfile(userId: string): Promise<void> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { lastSyncedAt: true },
      });

      if (user && Date.now() - user.lastSyncedAt.getTime() < SYNC_COOLDOWN_MS) {
        return;
      }

      const discordUser = await this.client.users.fetch(userId);
      const avatarUrl = discordUser.displayAvatarURL();

      await this.prisma.user.upsert({
        where: { id: userId },
        create: {
          id: userId,
          username: discordUser.username,
          avatarUrl,
          lastSyncedAt: new Date(),
        },
        update: {
          username: discordUser.username,
          avatarUrl,
          lastSyncedAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.warn({ err, userId }, 'Discord API sync failed, skipping');
    }
  }

  async getMe(_companyId: string, userId: string): Promise<MeResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return { id: userId };
    }

    return {
      id: user.id,
      username: user.username,
      avatar_url: user.avatarUrl ?? undefined,
    };
  }
}
