import { Module, forwardRef } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { NecordModule } from 'necord';
import { GatewayIntentBits } from 'discord.js';
import { PrismaModule } from '../../common/prisma';
import { CompanyConfigModule } from '../config/config.module';
import { SuggestionsModule } from '../suggestions/suggestions.module';
import { UsersModule } from '../users/users.module';
import { VotesModule } from '../votes/votes.module';
import { DiscordCompanyGuard } from './guards/discord-company.guard';
import { BanCommand } from './commands/ban.command';
import { SuggestCommand } from './commands/suggest.command';
import { SuggestCategorySelectHandler } from './commands/suggest-category-select.handler';
import { SuggestModalHandler } from './commands/suggest-modal.handler';
import { DiscordPublishService, DISCORD_PUBLISH_QUEUE } from './discord-publish.service';
import { DiscordPublishProcessor } from './discord-publish.processor';
import { DiscordThreadSyncService } from './discord-thread-sync.service';
import { VoteButtonHandler } from './vote-button.handler';
import { VoteRateLimitService } from './vote-rate-limit.service';
import { BanNotificationListener } from './ban-notification.listener';
import { BansModule } from '../moderation/bans.module';

const necordModule = NecordModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => ({
    token: configService.get<string>('DISCORD_BOT_TOKEN') ?? '',
    intents: [GatewayIntentBits.Guilds],
    development: configService.get<string>('DISCORD_DEVELOPMENT_GUILD_ID')
      ? [configService.get<string>('DISCORD_DEVELOPMENT_GUILD_ID')!]
      : undefined,
    // В E2E не регистрируем slash-команды — тестируем HTTP API, не Discord
    skipRegistration: process.env.NODE_ENV === 'test',
  }),
  inject: [ConfigService],
});

@Module({
  imports: [
    necordModule,
    BullModule.registerQueue({ name: DISCORD_PUBLISH_QUEUE }),
    PrismaModule,
    CompanyConfigModule,
    SuggestionsModule,
    VotesModule,
    BansModule,
    forwardRef(() => UsersModule),
  ],
  exports: [necordModule],
  providers: [
    DiscordCompanyGuard,
    BanCommand,
    SuggestCommand,
    SuggestCategorySelectHandler,
    SuggestModalHandler,
    DiscordPublishService,
    DiscordPublishProcessor,
    DiscordThreadSyncService,
    VoteButtonHandler,
    VoteRateLimitService,
    BanNotificationListener,
    {
      provide: APP_GUARD,
      useClass: DiscordCompanyGuard,
    },
  ],
})
export class DiscordModule {}
