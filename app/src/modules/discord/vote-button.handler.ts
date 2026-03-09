import { Injectable } from '@nestjs/common';
import { Button, ComponentParam, Ctx } from 'necord';
import type { ButtonInteraction, InteractionResponse } from 'discord.js';
import { PinoLogger } from 'nestjs-pino';
import { appendDiscordBlockSync } from '../../common/dev-log/dev-debug-log.stream';
import { DiscordCompany } from './decorators/discord-company.decorator';
import { BansService } from '../moderation/bans.service';
import { UsersService } from '../users/users.service';
import { VotesService } from '../votes/votes.service';
import { VoteRateLimitService } from './vote-rate-limit.service';
import { buildVoteButtons } from './vote-buttons.util';

const RATE_LIMIT_MESSAGE = 'Пожалуйста, подождите пару секунд перед повторным голосованием';
const BANNED_MESSAGE = 'Пользователь заблокирован';

@Injectable()
export class VoteButtonHandler {
  constructor(
    private readonly voteRateLimitService: VoteRateLimitService,
    private readonly usersService: UsersService,
    private readonly bansService: BansService,
    private readonly votesService: VotesService,
    private readonly logger: PinoLogger,
  ) {}

  @Button('vote_up_:suggestionId')
  public async onVoteUp(
    @Ctx() [interaction]: [ButtonInteraction],
    @DiscordCompany() companyId: string,
    @ComponentParam('suggestionId') suggestionId: string,
  ): Promise<InteractionResponse | void> {
    return this.handleVote(interaction, companyId, suggestionId, 1);
  }

  @Button('vote_down_:suggestionId')
  public async onVoteDown(
    @Ctx() [interaction]: [ButtonInteraction],
    @DiscordCompany() companyId: string,
    @ComponentParam('suggestionId') suggestionId: string,
  ): Promise<InteractionResponse | void> {
    return this.handleVote(interaction, companyId, suggestionId, -1);
  }

  private async handleVote(
    interaction: ButtonInteraction,
    companyId: string,
    suggestionId: string,
    type: 1 | -1,
  ): Promise<InteractionResponse | void> {
    const userId = interaction.user.id;

    const acquired = await this.voteRateLimitService.tryAcquire(companyId, userId, suggestionId);
    if (!acquired) {
      const discordLog = {
        event: 'vote_button',
        companyId,
        suggestionId,
        userId,
        direction: type,
        result: 'rejected',
        reason: 'rate_limit',
      };
      this.logger.info({ type: 'discord', ...discordLog });
      appendDiscordBlockSync(discordLog);
      return interaction.reply({
        content: RATE_LIMIT_MESSAGE,
        ephemeral: true,
      });
    }

    this.usersService.syncProfile(userId).catch(() => {});

    const isBanned = await this.bansService.isBanned(companyId, userId);
    if (isBanned) {
      const discordLog = {
        event: 'vote_button',
        companyId,
        suggestionId,
        userId,
        direction: type,
        result: 'rejected',
        reason: 'banned',
      };
      this.logger.info({ type: 'discord', ...discordLog });
      appendDiscordBlockSync(discordLog);
      return interaction.reply({
        content: BANNED_MESSAGE,
        ephemeral: true,
      });
    }

    try {
      const result = await this.votesService.toggleVote(companyId, userId, suggestionId, type);

      const discordLog = {
        event: 'vote_button',
        companyId,
        suggestionId,
        userId,
        direction: type,
        result: 'toggled',
        upvotes: result.upvotes,
        downvotes: result.downvotes,
      };
      this.logger.info({ type: 'discord', ...discordLog });
      appendDiscordBlockSync(discordLog);

      return interaction.update({
        components: buildVoteButtons(suggestionId, result.upvotes, result.downvotes),
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Не удалось проголосовать';
      appendDiscordBlockSync({
        event: 'vote_button',
        companyId,
        suggestionId,
        userId,
        direction: type,
        result: 'error',
        error: errorMessage,
      });
      if (interaction.replied || interaction.deferred) {
        return;
      }
      return interaction.reply({
        content: errorMessage,
        ephemeral: true,
      });
    }
  }
}
