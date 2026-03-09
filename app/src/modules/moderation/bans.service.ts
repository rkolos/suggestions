import { Injectable, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Prisma } from '@prisma/client';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export const USER_BANNED_CODE = 'USER_BANNED';

@Injectable()
export class BansService {
  constructor(private readonly prisma: PrismaService) {}

  async banUser(companyId: string, userId: string): Promise<boolean> {
    try {
      await this.prisma.bannedUser.create({
        data: { companyId, userId },
      });
      return true;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Пользователь уже забанен');
      }
      throw e;
    }
  }

  async unbanUser(companyId: string, userId: string): Promise<void> {
    await this.prisma.bannedUser.deleteMany({
      where: { companyId, userId },
    });
  }

  async isBanned(companyId: string, userId: string): Promise<boolean> {
    const banned = await this.prisma.bannedUser.findUnique({
      where: {
        companyId_userId: { companyId, userId },
      },
    });
    return !!banned;
  }

  async getBannedUsers(
    companyId: string,
    page = 1,
    limit = DEFAULT_LIMIT,
  ): Promise<{
    items: { userId: string; bannedAt: Date }[];
    total: number;
    page: number;
    limit: number;
  }> {
    const take = Math.min(MAX_LIMIT, Math.max(1, limit));
    const skip = (page - 1) * take;

    const [items, total] = await Promise.all([
      this.prisma.bannedUser.findMany({
        where: { companyId },
        skip,
        take,
        orderBy: { bannedAt: 'desc' },
      }),
      this.prisma.bannedUser.count({ where: { companyId } }),
    ]);

    return {
      items: items.map((b) => ({ userId: b.userId, bannedAt: b.bannedAt })),
      total,
      page,
      limit: take,
    };
  }

  async assertNotBanned(companyId: string, userId: string): Promise<void> {
    const banned = await this.isBanned(companyId, userId);
    if (banned) {
      throw new ForbiddenException({
        code: USER_BANNED_CODE,
        message: 'Пользователь заблокирован',
      });
    }
  }
}
