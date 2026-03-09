import { Module } from '@nestjs/common';
import { BansController } from './bans.controller';
import { BansService } from './bans.service';
import { PrismaModule } from '../../common/prisma';

@Module({
  imports: [PrismaModule],
  controllers: [BansController],
  providers: [BansService],
  exports: [BansService],
})
export class BansModule {}
