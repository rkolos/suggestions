import { PrismaClient } from '@prisma/client';

/**
 * Seed-скрипт для создания системного пользователя и опциональных dev-данных.
 * Запуск: npx prisma db seed
 *
 * Конвенция: идентификатор "system" зарезервирован для технических действий
 * (комментарии при слиянии дубликатов, уведомления и т.д.).
 */
const prisma = new PrismaClient();

const SYSTEM_USER_ID = 'system';

async function main(): Promise<void> {
  await prisma.user.upsert({
    where: { id: SYSTEM_USER_ID },
    create: {
      id: SYSTEM_USER_ID,
      username: 'System',
      avatarUrl: null,
    },
    update: {
      username: 'System',
      avatarUrl: null,
    },
  });

  console.log(`System user (id="${SYSTEM_USER_ID}") ensured.`);

  const devGuildId = process.env.DISCORD_DEVELOPMENT_GUILD_ID?.trim();
  const devChannelId = process.env.DISCORD_DEVELOPMENT_CHANNEL_ID?.trim();
  const cordeGuildId = process.env.CORDE_GUILD_ID?.trim();
  const cordeChannelId = process.env.CORDE_CHANNEL_ID?.trim();

  if (cordeGuildId) {
    const CORDE_COMPANY_ID = '00000000-0000-0000-0000-000000000002';
    const existingByGuild = await prisma.companyConfig.findUnique({
      where: { discordGuildId: cordeGuildId },
    });
    if (existingByGuild && existingByGuild.companyId !== CORDE_COMPANY_ID) {
      await prisma.companyConfig.update({
        where: { companyId: existingByGuild.companyId },
        data: { discordGuildId: null },
      });
    }
    await prisma.companyConfig.upsert({
      where: { companyId: CORDE_COMPANY_ID },
      create: {
        companyId: CORDE_COMPANY_ID,
        discordGuildId: cordeGuildId,
        suggestionsChannelId: cordeChannelId || null,
      },
      update: {
        discordGuildId: cordeGuildId,
        ...(cordeChannelId && { suggestionsChannelId: cordeChannelId }),
      },
    });
    console.log(
      `Corde company ensured: companyId=${CORDE_COMPANY_ID}, guildId=${cordeGuildId}${cordeChannelId ? `, channelId=${cordeChannelId}` : ''}`,
    );
  }

  // В разработке компания с каналом Discord — фиксированный ID, чтобы можно было
  // всегда использовать X-Company-Id: 00000000-0000-0000-0000-000000000001 и получать публикацию в канал.
  const DEV_COMPANY_ID = '00000000-0000-0000-0000-000000000001';
  if (devGuildId) {
    const existingByGuild = await prisma.companyConfig.findUnique({
      where: { discordGuildId: devGuildId },
    });
    if (existingByGuild && existingByGuild.companyId !== DEV_COMPANY_ID) {
      await prisma.companyConfig.update({
        where: { companyId: existingByGuild.companyId },
        data: { discordGuildId: null },
      });
    }
    await prisma.companyConfig.upsert({
      where: { companyId: DEV_COMPANY_ID },
      create: {
        companyId: DEV_COMPANY_ID,
        discordGuildId: devGuildId,
        suggestionsChannelId: devChannelId || null,
      },
      update: {
        discordGuildId: devGuildId,
        ...(devChannelId && { suggestionsChannelId: devChannelId }),
      },
    });
    console.log(
      `Dev company ensured: companyId=${DEV_COMPANY_ID}, discordGuildId=${devGuildId}${devChannelId ? `, suggestionsChannelId=${devChannelId}` : ''}. В запросах используйте X-Company-Id: ${DEV_COMPANY_ID}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
