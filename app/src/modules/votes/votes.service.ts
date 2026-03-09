import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BansService } from '../moderation/bans.service';
import { SuggestionStatus } from '@prisma/client';

const VOTABLE_STATUSES: SuggestionStatus[] = [SuggestionStatus.OPEN];

export interface ToggleVoteResult {
  upvotes: number;
  downvotes: number;
  userVote: 1 | -1 | null;
}

export interface VoteCounts {
  upvotes: number;
  downvotes: number;
}

@Injectable()
export class VotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bansService: BansService,
  ) {}

  async getVoteCounts(suggestionId: string): Promise<VoteCounts> {
    const votes = await this.prisma.vote.findMany({
      where: { suggestionId },
    });
    const upvotes = votes.filter((v) => v.type === 1).length;
    const downvotes = votes.filter((v) => v.type === -1).length;
    return { upvotes, downvotes };
  }

  private async ensureUser(userId: string): Promise<void> {
    await this.prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        username: `user_${userId.slice(0, 8)}`,
        avatarUrl: null,
      },
      update: {},
    });
  }

  async toggleVote(
    companyId: string,
    userId: string,
    suggestionId: string,
    type: 1 | -1,
  ): Promise<ToggleVoteResult> {
    await this.bansService.assertNotBanned(companyId, userId);
    await this.ensureUser(userId);

    const suggestion = await this.prisma.suggestion.findFirst({
      where: { id: suggestionId, companyId },
    });

    if (!suggestion) {
      throw new NotFoundException('Suggestion not found');
    }

    if (!VOTABLE_STATUSES.includes(suggestion.status)) {
      throw new NotFoundException(
        `Voting is not available for suggestions in status ${suggestion.status}`,
      );
    }

    const existingVote = await this.prisma.vote.findUnique({
      where: {
        userId_suggestionId: { userId, suggestionId },
      },
    });

    await this.prisma.$transaction(async (tx) => {
      if (!existingVote) {
        await tx.vote.create({
          data: { userId, suggestionId, type },
        });
      } else if (existingVote.type === type) {
        await tx.vote.delete({
          where: {
            userId_suggestionId: { userId, suggestionId },
          },
        });
      } else {
        await tx.vote.update({
          where: {
            userId_suggestionId: { userId, suggestionId },
          },
          data: { type },
        });
      }
    });

    const votes = await this.prisma.vote.findMany({
      where: { suggestionId },
    });

    const upvotes = votes.filter((v) => v.type === 1).length;
    const downvotes = votes.filter((v) => v.type === -1).length;

    let userVote: 1 | -1 | null = null;
    if (existingVote) {
      if (existingVote.type === type) {
        userVote = null;
      } else {
        userVote = type;
      }
    } else {
      userVote = type;
    }

    return { upvotes, downvotes, userVote };
  }
}
