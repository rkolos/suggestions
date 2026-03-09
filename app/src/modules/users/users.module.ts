import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma';
import { DiscordModule } from '../discord/discord.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [PrismaModule, forwardRef(() => DiscordModule)],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
