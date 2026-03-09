import * as path from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { BullModule } from '@nestjs/bullmq';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './common/prisma';
import { DiscordModule } from './modules/discord/discord.module';
import { SuggestionsModule } from './modules/suggestions/suggestions.module';
import { VotesModule } from './modules/votes/votes.module';
import { CommentsModule } from './modules/comments/comments.module';
import { BansModule } from './modules/moderation/bans.module';
import { CompanyConfigModule } from './modules/config/config.module';
import { UsersModule } from './modules/users/users.module';
import { AiIntegrationModule } from './modules/ai-integration/ai-integration.module';
import { TestingModule } from './modules/testing/testing.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { validateEnv } from './config/env.validation';
import { HealthController } from './health/health.controller';
import { ContextController } from './context/context.controller';
import { getLoggerConfig } from './logger.config';
import { DevDebugLogModule } from './common/dev-log/dev-debug-log.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [path.resolve(process.cwd(), '.env'), path.resolve(__dirname, '..', '.env')],
      validate: (config) => validateEnv(config as Record<string, unknown>),
    }),
    EventEmitterModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          url: configService.get<string>('REDIS_URL'),
        },
      }),
      inject: [ConfigService],
    }),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        store: await redisStore({
          url: configService.get<string>('REDIS_URL'),
        }),
      }),
      inject: [ConfigService],
      isGlobal: true,
    }),
    PrismaModule,
    DiscordModule,
    CompanyConfigModule,
    SuggestionsModule,
    VotesModule,
    CommentsModule,
    BansModule,
    UsersModule,
    AiIntegrationModule,
    LoggerModule.forRootAsync({
      useFactory: () => getLoggerConfig(),
    }),
    DevDebugLogModule,
    ...(process.env.NODE_ENV === 'test' ? [TestingModule] : []),
  ],
  controllers: [HealthController, ContextController],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
