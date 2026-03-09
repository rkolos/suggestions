import { Module } from '@nestjs/common';
import { VotesService } from './votes.service';
import { PrismaModule } from '../../common/prisma';
import { BansModule } from '../moderation/bans.module';

@Module({
  imports: [PrismaModule, BansModule],
  providers: [VotesService],
  exports: [VotesService],
})
export class VotesModule {}
