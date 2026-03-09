import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Prisma } from '@prisma/client';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(
    companyId: string,
    suggestionId: string,
    authorId: string,
    body: string,
    isInternal: boolean,
  ): Promise<Prisma.CommentGetPayload<{ include: { author: true } }>> {
    const suggestion = await this.prisma.suggestion.findFirst({
      where: { id: suggestionId, companyId },
    });

    if (!suggestion) {
      throw new NotFoundException('Предложение не найдено');
    }

    const comment = await this.prisma.comment.create({
      data: {
        suggestionId,
        authorId,
        body,
        isInternal,
      },
      include: { author: true },
    });

    if (!isInternal) {
      this.eventEmitter.emit('comment.public.created', {
        companyId,
        suggestionId,
        comment,
      });
    }

    return comment;
  }

  async findBySuggestionId(
    companyId: string,
    suggestionId: string,
    page = 1,
    limit = DEFAULT_LIMIT,
  ): Promise<{
    items: Prisma.CommentGetPayload<{ include: { author: true } }>[];
    total: number;
    page: number;
    limit: number;
  }> {
    const suggestion = await this.prisma.suggestion.findFirst({
      where: { id: suggestionId, companyId },
    });

    if (!suggestion) {
      throw new NotFoundException('Предложение не найдено');
    }

    const take = Math.min(MAX_LIMIT, Math.max(1, limit));
    const skip = (page - 1) * take;

    const [items, total] = await Promise.all([
      this.prisma.comment.findMany({
        where: { suggestionId },
        skip,
        take,
        orderBy: { createdAt: 'asc' },
        include: { author: true },
      }),
      this.prisma.comment.count({ where: { suggestionId } }),
    ]);

    return { items, total, page, limit: take };
  }

  async update(
    companyId: string,
    commentId: string,
    body: string,
  ): Promise<Prisma.CommentGetPayload<{ include: { author: true } }>> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: { suggestion: true },
    });

    if (!comment || comment.suggestion.companyId !== companyId) {
      throw new NotFoundException('Комментарий не найден');
    }

    return this.prisma.comment.update({
      where: { id: commentId },
      data: { body },
      include: { author: true },
    });
  }

  async delete(companyId: string, commentId: string): Promise<void> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      include: { suggestion: true },
    });

    if (!comment || comment.suggestion.companyId !== companyId) {
      throw new NotFoundException('Комментарий не найден');
    }

    await this.prisma.comment.delete({
      where: { id: commentId },
    });
  }
}
