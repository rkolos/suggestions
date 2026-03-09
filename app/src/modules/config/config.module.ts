import { Module } from '@nestjs/common';
import { CompanyConfigService } from './company-config.service';
import { ConfigController } from './config.controller';
import { NotificationsController } from './notifications.controller';
import { PrismaModule } from '../../common/prisma';

@Module({
  imports: [PrismaModule],
  controllers: [ConfigController, NotificationsController],
  providers: [CompanyConfigService],
  exports: [CompanyConfigService],
})
export class CompanyConfigModule {}
