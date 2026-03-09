import { Module } from '@nestjs/common';
import { SuggestionsService } from './suggestions.service';
import { SuggestionsController } from './suggestions.controller';
import { BulkController } from './bulk.controller';
import { SuggestionStatusChangedListener } from './listeners/suggestion-status-changed.listener';
import { PrismaModule } from '../../common/prisma';
import { CommentsModule } from '../comments/comments.module';
import { BansModule } from '../moderation/bans.module';
import { VotesModule } from '../votes/votes.module';
import { AiIntegrationModule } from '../ai-integration/ai-integration.module';
import { CompanyConfigModule } from '../config/config.module';

@Module({
  imports: [
    PrismaModule,
    CommentsModule,
    BansModule,
    VotesModule,
    AiIntegrationModule,
    CompanyConfigModule,
  ],
  controllers: [SuggestionsController, BulkController],
  providers: [SuggestionsService, SuggestionStatusChangedListener],
  exports: [SuggestionsService],
})
export class SuggestionsModule {}
