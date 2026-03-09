import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { UpdateConfigDto } from './dto/update-config.dto';

const DEFAULT_NOTIFICATIONS = {
  ticket_created: 'Привет, {{user}}! Твоя идея №{{id}} принята в работу.',
  ticket_approved: 'Отличные новости! Идея {{title}} одобрена.',
  ticket_rejected: 'К сожалению, мы не будем это реализовывать.',
};

const DEFAULT_CATEGORIES: { id: string; label: string; color: string }[] = [
  { id: 'general', label: 'General', color: '#95a5a6' },
  { id: 'feature-request', label: 'Feature request', color: '#3498db' },
  { id: 'improvement', label: 'Improvement', color: '#2ecc71' },
  { id: 'bug-report', label: 'Bug report', color: '#e74c3c' },
  { id: 'other', label: 'Other', color: '#7f8c8d' },
];

@Injectable()
export class CompanyConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getConfig(companyId: string): Promise<{
    categories: unknown[];
    notifications: Record<string, string>;
    suggestionsChannelId: string | null;
    version?: string;
  }> {
    const config = await this.prisma.companyConfig.upsert({
      where: { companyId },
      create: {
        companyId,
        categories: DEFAULT_CATEGORIES,
        notificationTemplates: DEFAULT_NOTIFICATIONS,
      },
      update: {},
    });

    return {
      categories: (config.categories as unknown[]) ?? DEFAULT_CATEGORIES,
      notifications:
        (config.notificationTemplates as Record<string, string>) ?? DEFAULT_NOTIFICATIONS,
      suggestionsChannelId: config.suggestionsChannelId,
    };
  }

  async updateConfig(
    companyId: string,
    data: UpdateConfigDto,
  ): Promise<{
    categories: unknown[];
    notifications: Record<string, string>;
    suggestionsChannelId: string | null;
  }> {
    const updateData: {
      categories?: object;
      notificationTemplates?: object;
      suggestionsChannelId?: string | null;
    } = {};

    if (data.categories !== undefined) {
      updateData.categories = data.categories as object;
    }
    if (data.notifications !== undefined) {
      updateData.notificationTemplates = data.notifications as object;
    }
    if (data.suggestionsChannelId !== undefined) {
      updateData.suggestionsChannelId = data.suggestionsChannelId;
    }

    const config = await this.prisma.companyConfig.upsert({
      where: { companyId },
      create: {
        companyId,
        categories: (data.categories ?? DEFAULT_CATEGORIES) as object,
        notificationTemplates: (data.notifications ?? DEFAULT_NOTIFICATIONS) as object,
        suggestionsChannelId: data.suggestionsChannelId ?? null,
      },
      update: updateData,
    });

    return {
      categories: (config.categories as unknown[]) ?? DEFAULT_CATEGORIES,
      notifications:
        (config.notificationTemplates as Record<string, string>) ?? DEFAULT_NOTIFICATIONS,
      suggestionsChannelId: config.suggestionsChannelId,
    };
  }

  getDefaultConfig(): {
    categories: { id: string; label: string; color: string }[];
    notifications: Record<string, string>;
  } {
    return {
      categories: DEFAULT_CATEGORIES,
      notifications: { ...DEFAULT_NOTIFICATIONS },
    };
  }

  async getNotifications(companyId: string): Promise<Record<string, string>> {
    const config = await this.getConfig(companyId);
    return config.notifications;
  }

  async findByDiscordGuildId(discordGuildId: string): Promise<{ companyId: string } | null> {
    const config = await this.prisma.companyConfig.findUnique({
      where: { discordGuildId },
      select: { companyId: true },
    });
    return config;
  }

  async updateNotifications(
    companyId: string,
    notifications: Record<string, string>,
  ): Promise<Record<string, string>> {
    const config = await this.prisma.companyConfig.upsert({
      where: { companyId },
      create: {
        companyId,
        categories: DEFAULT_CATEGORIES,
        notificationTemplates: notifications,
      },
      update: { notificationTemplates: notifications },
    });
    return (config.notificationTemplates as Record<string, string>) ?? DEFAULT_NOTIFICATIONS;
  }
}
