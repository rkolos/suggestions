import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AiIntegrationService, AI_SYNC_QUEUE } from './ai-integration.service';
import { AiSyncProcessor } from './ai-sync.processor';

@Module({
  imports: [BullModule.registerQueue({ name: AI_SYNC_QUEUE })],
  providers: [AiIntegrationService, AiSyncProcessor],
  exports: [AiIntegrationService],
})
export class AiIntegrationModule {}
