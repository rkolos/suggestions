import { ConflictException, Injectable } from '@nestjs/common';
import type { User } from 'discord.js';
import { PermissionFlagsBits } from 'discord.js';
import { Context, Options, SlashCommand, SlashCommandContext, UserOption } from 'necord';
import { DiscordCompany } from '../decorators/discord-company.decorator';
import { BansService } from '../../moderation/bans.service';

const BAN_SUCCESS_MESSAGE = 'User has been banned from suggestions.';
const BAN_ALREADY_MESSAGE = 'User is already banned.';
const UNBAN_SUCCESS_MESSAGE = 'User has been unbanned.';

const MODERATOR_PERMISSIONS = PermissionFlagsBits.ManageGuild;

class BanUserOptionsDto {
  @UserOption({
    name: 'user',
    description: 'User to ban from suggestions and voting',
    required: true,
  })
  user!: User;
}

@Injectable()
export class BanCommand {
  constructor(private readonly bansService: BansService) {}

  @SlashCommand({
    name: 'ban',
    description: 'Ban a user from submitting suggestions and voting on this server.',
    defaultMemberPermissions: MODERATOR_PERMISSIONS,
    dmPermission: false,
  })
  public async onBan(
    @Context() [interaction]: SlashCommandContext,
    @DiscordCompany() companyId: string,
    @Options() { user }: BanUserOptionsDto,
  ): Promise<void> {
    try {
      await this.bansService.banUser(companyId, user.id);
      await interaction.reply({ content: BAN_SUCCESS_MESSAGE, ephemeral: true });
    } catch (e) {
      if (e instanceof ConflictException) {
        await interaction.reply({ content: BAN_ALREADY_MESSAGE, ephemeral: true });
        return;
      }
      throw e;
    }
  }

  @SlashCommand({
    name: 'unban',
    description: "Remove a user's ban from suggestions and voting.",
    defaultMemberPermissions: MODERATOR_PERMISSIONS,
    dmPermission: false,
  })
  public async onUnban(
    @Context() [interaction]: SlashCommandContext,
    @DiscordCompany() companyId: string,
    @Options() { user }: BanUserOptionsDto,
  ): Promise<void> {
    await this.bansService.unbanUser(companyId, user.id);
    await interaction.reply({ content: UNBAN_SUCCESS_MESSAGE, ephemeral: true });
  }
}
