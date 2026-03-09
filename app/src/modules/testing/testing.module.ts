import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma';
import { TestingController } from './testing.controller';

@Module({
  imports: [PrismaModule],
  controllers: [TestingController],
})
export class TestingModule {}
