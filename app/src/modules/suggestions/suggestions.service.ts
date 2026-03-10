import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BansService } from '../moderation/bans.service';
import { CommentsService } from '../comments/comments.service';
import { SYSTEM_USER_ID } from '../../common/constants';
import { Prisma, SuggestionSource, SuggestionStatus } from '@prisma/client';
import { CreateSuggestionDto } from './dto/create-suggestion.dto';
import { UpdateSuggestionDto } from './dto/update-suggestion.dto';
import { GetSuggestionsFilterDto } from './dto/get-suggestions-filter.dto';
import { titleToSlug } from './utils/slug.utils';
import { generateSuggestionId } from './utils/id.utils';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

@Injectable()
export class SuggestionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
    private readonly bansService: BansService,
    private readonly commentsService: CommentsService,
  ) {}

  /**
   * Lazy Create: создаёт минимальную запись пользователя, если её ещё нет.
   * Предотвращает ошибки FK при создании предложений и голосов.
   */
  private async ensureUser(authorId: string): Promise<void> {
    await this.prisma.user.upsert({
      where: { id: authorId },
      create: {
        id: authorId,
        username: `user_${authorId.slice(0, 8)}`,
        avatarUrl: null,
      },
      update: {},
    });
  }

  /**
   * Генерирует уникальный slug в рамках компании.
   */
  private async generateUniqueSlug(
    companyId: string,
    title: string,
    excludeId?: string,
  ): Promise<string> {
    const baseSlug = titleToSlug(title);
    let slug = baseSlug;
    let suffix = 0;

    while (true) {
      const existing = await this.prisma.suggestion.findFirst({
        where: {
          companyId,
          slug,
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
      });
      if (!existing) return slug;
      suffix += 1;
      slug = `${baseSlug}-${suffix}`;
    }
  }

  async create(
    companyId: string,
    authorId: string,
    data: CreateSuggestionDto,
  ): Promise<Prisma.SuggestionGetPayload<object>> {
    await this.bansService.assertNotBanned(companyId, authorId);
    await this.ensureUser(authorId);

    const isOfficial = data.isOfficial ?? false;
    const source = data.source === 'DISCORD' ? SuggestionSource.DISCORD : SuggestionSource.WEB;
    const status = isOfficial ? SuggestionStatus.OPEN : SuggestionStatus.NEW;

    const id = generateSuggestionId(isOfficial);
    const slug = await this.generateUniqueSlug(companyId, data.title);

    const suggestion = await this.prisma.suggestion.create({
      data: {
        id,
        companyId,
        authorId,
        title: data.title,
        description: data.description,
        category: data.category,
        source,
        status,
        slug,
        isOfficial,
        type: isOfficial ? 'official_proposal' : null,
        isPinned: isOfficial,
        images: data.images ?? [],
      },
      include: {
        author: true,
        votes: true,
      },
    });

    this.eventEmitter.emit('suggestion.created', suggestion);

    const autoApprove = this.configService.get<string>('AUTO_APPROVE') !== 'false';
    if (autoApprove && suggestion.status === SuggestionStatus.NEW) {
      return this.updateStatus(companyId, suggestion.id, SuggestionStatus.OPEN);
    }
    return suggestion;
  }

  async findAll(
    companyId: string,
    query: GetSuggestionsFilterDto,
    userId?: string,
  ): Promise<{
    items: (Prisma.SuggestionGetPayload<{ include: { author: true; votes: true } }> & {
      upvotes?: number;
      downvotes?: number;
    })[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(1, query.page ?? DEFAULT_PAGE);
    const limit = Math.min(MAX_LIMIT, Math.max(1, query.limit ?? DEFAULT_LIMIT));
    const skip = (page - 1) * limit;

    const where: Prisma.SuggestionWhereInput = { companyId };

    if (query.status?.length) {
      where.status = { in: query.status as SuggestionStatus[] };
    }
    if (query.category) {
      where.category = query.category;
    }
    if (query.authorId) {
      where.authorId = query.authorId;
    }

    const sort = query.sort ?? 'createdAt';
    const order = query.order ?? 'desc';
    const orderBy: Prisma.SuggestionOrderByWithRelationInput =
      sort === 'score' ? { votes: { _count: order } } : { createdAt: order };

    const useOptimizedPath = userId != null && sort !== 'score';

    const [items, total] = await Promise.all([
      this.prisma.suggestion.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          author: true,
          votes: useOptimizedPath ? { where: { userId: userId! } } : true,
        },
      }),
      this.prisma.suggestion.count({ where }),
    ]);

    if (useOptimizedPath && items.length > 0) {
      const ids = items.map((i) => i.id);
      const voteCounts = await this.prisma.vote.groupBy({
        by: ['suggestionId', 'type'],
        where: {
          suggestionId: { in: ids },
          suggestion: { companyId },
        },
        _count: { userId: true },
      });

      const metricsMap = new Map<string, { upvotes: number; downvotes: number }>();
      for (const id of ids) {
        metricsMap.set(id, { upvotes: 0, downvotes: 0 });
      }
      for (const row of voteCounts) {
        const current = metricsMap.get(row.suggestionId)!;
        if (row.type === 1) {
          current.upvotes = row._count.userId;
        } else {
          current.downvotes = row._count.userId;
        }
      }

      return {
        items: items.map((item) => {
          const metrics = metricsMap.get(item.id)!;
          return { ...item, upvotes: metrics.upvotes, downvotes: metrics.downvotes };
        }),
        total,
        page,
        limit,
      };
    }

    return { items, total, page, limit };
  }

  async findById(
    companyId: string,
    suggestionId: string,
    userId?: string,
  ): Promise<
    Prisma.SuggestionGetPayload<{ include: { author: true; votes: true } }> & {
      upvotes?: number;
      downvotes?: number;
    }
  > {
    const useOptimizedPath = userId != null;

    const suggestion = await this.prisma.suggestion.findFirst({
      where: { companyId, id: suggestionId },
      include: {
        author: true,
        votes: useOptimizedPath ? { where: { userId: userId! } } : true,
      },
    });

    if (!suggestion) {
      throw new NotFoundException('Suggestion not found');
    }

    if (useOptimizedPath) {
      const voteCounts = await this.prisma.vote.groupBy({
        by: ['type'],
        where: {
          suggestionId,
          suggestion: { companyId },
        },
        _count: { userId: true },
      });

      let upvotes = 0;
      let downvotes = 0;
      for (const row of voteCounts) {
        if (row.type === 1) upvotes = row._count.userId;
        else downvotes = row._count.userId;
      }

      return { ...suggestion, upvotes, downvotes };
    }

    return suggestion;
  }

  async findByDiscordThreadId(
    companyId: string,
    discordThreadId: string,
  ): Promise<Prisma.SuggestionGetPayload<{ include: { author: true; votes: true } }>> {
    const suggestion = await this.prisma.suggestion.findFirst({
      where: { companyId, discordThreadId },
      include: {
        author: true,
        votes: true,
      },
    });

    if (!suggestion) {
      throw new NotFoundException('Suggestion not found for this thread.');
    }

    return suggestion;
  }

  async findByIds(
    companyId: string,
    ids: string[],
    userId?: string,
  ): Promise<
    (Prisma.SuggestionGetPayload<{ include: { author: true; votes: true } }> & {
      upvotes?: number;
      downvotes?: number;
    })[]
  > {
    if (ids.length === 0) return [];

    const items = await this.prisma.suggestion.findMany({
      where: { id: { in: ids }, companyId },
      include: {
        author: true,
        votes: userId != null ? { where: { userId: userId! } } : true,
      },
    });

    const orderMap = new Map(ids.map((id, i) => [id, i]));
    const sorted = [...items].sort(
      (a, b) => (orderMap.get(a.id) ?? 999) - (orderMap.get(b.id) ?? 999),
    );

    if (userId != null && sorted.length > 0) {
      const voteCounts = await this.prisma.vote.groupBy({
        by: ['suggestionId', 'type'],
        where: {
          suggestionId: { in: ids },
          suggestion: { companyId },
        },
        _count: { userId: true },
      });

      const metricsMap = new Map<string, { upvotes: number; downvotes: number }>();
      for (const id of ids) {
        metricsMap.set(id, { upvotes: 0, downvotes: 0 });
      }
      for (const row of voteCounts) {
        const current = metricsMap.get(row.suggestionId)!;
        if (row.type === 1) {
          current.upvotes = row._count.userId;
        } else {
          current.downvotes = row._count.userId;
        }
      }

      return sorted.map((item) => {
        const metrics = metricsMap.get(item.id)!;
        return { ...item, upvotes: metrics.upvotes, downvotes: metrics.downvotes };
      });
    }

    return sorted;
  }

  async dismissDuplicates(companyId: string, suggestionId: string): Promise<void> {
    await this.findById(companyId, suggestionId);
    await this.prisma.suggestion.update({
      where: { id: suggestionId, companyId },
      data: { dismissedDuplicatesAt: new Date() },
    });
  }

  async update(
    companyId: string,
    suggestionId: string,
    data: UpdateSuggestionDto,
  ): Promise<Prisma.SuggestionGetPayload<{ include: { author: true; votes: true } }>> {
    await this.findById(companyId, suggestionId);

    const updateData: Prisma.SuggestionUpdateInput = {};

    if (data.title !== undefined) {
      updateData.title = data.title;
      updateData.slug = await this.generateUniqueSlug(companyId, data.title, suggestionId);
    }
    if (data.description !== undefined) updateData.description = data.description;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.images !== undefined) updateData.images = data.images;

    const suggestion = await this.prisma.suggestion.update({
      where: { id: suggestionId, companyId },
      data: updateData,
      include: {
        author: true,
        votes: true,
      },
    });

    this.eventEmitter.emit('suggestion.updated', suggestion);
    return suggestion;
  }

  async updateDiscordIds(
    companyId: string,
    suggestionId: string,
    data: { discordMessageId?: string; discordThreadId?: string },
  ): Promise<Prisma.SuggestionGetPayload<object>> {
    await this.findById(companyId, suggestionId);

    return this.prisma.suggestion.update({
      where: { id: suggestionId, companyId },
      data: {
        ...(data.discordMessageId !== undefined && { discordMessageId: data.discordMessageId }),
        ...(data.discordThreadId !== undefined && { discordThreadId: data.discordThreadId }),
      },
    });
  }

  async mergeSuggestions(
    companyId: string,
    sourceId: string,
    targetId: string,
  ): Promise<Prisma.SuggestionGetPayload<{ include: { author: true; votes: true } }>> {
    if (sourceId === targetId) {
      throw new NotFoundException('Cannot merge a suggestion with itself');
    }

    const [source, target] = await Promise.all([
      this.prisma.suggestion.findFirst({
        where: { id: sourceId, companyId },
        include: { author: true, votes: true },
      }),
      this.prisma.suggestion.findFirst({
        where: { id: targetId, companyId },
      }),
    ]);

    if (!source || !target) {
      throw new NotFoundException('One or both suggestions not found');
    }

    if (source.status === SuggestionStatus.DUPLICATE || source.mergedIntoId) {
      throw new NotFoundException('Source suggestion is already a duplicate');
    }

    if (target.status === SuggestionStatus.DUPLICATE || target.mergedIntoId) {
      throw new NotFoundException('Cannot merge into a duplicate suggestion');
    }

    const updatedSource = await this.prisma.suggestion.update({
      where: { id: sourceId, companyId },
      data: {
        status: SuggestionStatus.DUPLICATE,
        mergedIntoId: targetId,
      },
      include: { author: true, votes: true },
    });

    await this.commentsService.create(
      companyId,
      targetId,
      SYSTEM_USER_ID,
      `Suggestion merged with [${target.id}]`,
      true,
    );

    this.eventEmitter.emit('suggestion.status.changed', {
      companyId,
      suggestionId: sourceId,
      oldStatus: source.status,
      newStatus: SuggestionStatus.DUPLICATE,
      suggestion: {
        id: updatedSource.id,
        companyId: updatedSource.companyId,
        authorId: updatedSource.authorId,
        title: updatedSource.title,
        description: updatedSource.description,
        category: updatedSource.category,
        status: updatedSource.status,
        discordMessageId: updatedSource.discordMessageId,
        discordThreadId: updatedSource.discordThreadId,
        mergedIntoId: updatedSource.mergedIntoId,
        author: updatedSource.author,
      },
      mergedInto: {
        id: target.id,
        title: target.title,
        description: target.description,
        discordMessageId: target.discordMessageId,
      },
    });

    this.eventEmitter.emit('suggestion.merged', {
      companyId,
      source: updatedSource,
      target: {
        id: target.id,
        title: target.title,
        slug: target.slug,
      },
    });

    return updatedSource;
  }

  async delete(companyId: string, suggestionId: string): Promise<void> {
    const suggestion = await this.findById(companyId, suggestionId);

    if (suggestion.discordMessageId ?? suggestion.discordThreadId) {
      this.eventEmitter.emit('suggestion.deleted', {
        companyId,
        suggestionId,
        discordMessageId: suggestion.discordMessageId ?? null,
        discordThreadId: suggestion.discordThreadId ?? null,
      });
    }

    await this.prisma.suggestion.delete({
      where: { id: suggestionId, companyId },
    });
  }

  async updateStatus(
    companyId: string,
    suggestionId: string,
    newStatus: SuggestionStatus,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- reserved for future use (e.g. internal note)
    _comment?: string,
  ): Promise<Prisma.SuggestionGetPayload<{ include: { author: true; votes: true } }>> {
    const existing = await this.findById(companyId, suggestionId);

    if (existing.status === newStatus) {
      return existing;
    }

    const oldStatus = existing.status;
    const suggestion = await this.prisma.suggestion.update({
      where: { id: suggestionId, companyId },
      data: { status: newStatus },
      include: {
        author: true,
        votes: true,
      },
    });

    const payload = {
      companyId,
      suggestionId,
      oldStatus,
      newStatus,
      suggestion: suggestion as {
        id: string;
        companyId: string;
        authorId: string;
        title: string;
        description: string;
        category: string;
        status: SuggestionStatus;
        [key: string]: unknown;
      },
    };

    this.eventEmitter.emit('suggestion.status.changed', payload);

    if (oldStatus === SuggestionStatus.NEW && newStatus === SuggestionStatus.OPEN) {
      this.eventEmitter.emit('suggestion.published', payload);
    }

    return suggestion;
  }

  async bulkDelete(
    companyId: string,
    ids: string[],
  ): Promise<{ deleted: string[]; failed: { id: string; error: string }[] }> {
    const existing = await this.prisma.suggestion.findMany({
      where: { id: { in: ids }, companyId },
      select: { id: true, discordMessageId: true, discordThreadId: true },
    });
    const foundIds = existing.map((s) => s.id);
    const failedIds = ids.filter((id) => !foundIds.includes(id));

    for (const s of existing) {
      if (s.discordMessageId ?? s.discordThreadId) {
        this.eventEmitter.emit('suggestion.deleted', {
          companyId,
          suggestionId: s.id,
          discordMessageId: s.discordMessageId ?? null,
          discordThreadId: s.discordThreadId ?? null,
        });
      }
    }

    if (foundIds.length > 0) {
      await this.prisma.suggestion.deleteMany({
        where: { id: { in: foundIds }, companyId },
      });
    }

    return {
      deleted: foundIds,
      failed: failedIds.map((id) => ({ id, error: 'Not found' })),
    };
  }

  async bulkUpdateStatus(
    companyId: string,
    ids: string[],
    status: SuggestionStatus,
  ): Promise<{
    updated: {
      id: string;
      suggestion: Prisma.SuggestionGetPayload<{ include: { author: true; votes: true } }>;
    }[];
    failed: { id: string; error: string }[];
  }> {
    const results = await Promise.allSettled(
      ids.map((id) => this.updateStatus(companyId, id, status)),
    );

    const updated: {
      id: string;
      suggestion: Prisma.SuggestionGetPayload<{ include: { author: true; votes: true } }>;
    }[] = [];
    const failed: { id: string; error: string }[] = [];

    results.forEach((result, index) => {
      const id = ids[index];
      if (result.status === 'fulfilled') {
        updated.push({ id, suggestion: result.value });
      } else {
        failed.push({
          id,
          error: result.reason?.message ?? String(result.reason),
        });
      }
    });

    return { updated, failed };
  }

  async getStats(companyId: string): Promise<{ total: number; byStatus: Record<string, number> }> {
    const [grouped, total] = await Promise.all([
      this.prisma.suggestion.groupBy({
        where: { companyId },
        by: ['status'],
        _count: { id: true },
      }),
      this.prisma.suggestion.count({ where: { companyId } }),
    ]);

    const statusToTitleCase: Record<SuggestionStatus, string> = {
      [SuggestionStatus.NEW]: 'New',
      [SuggestionStatus.OPEN]: 'Open',
      [SuggestionStatus.DUPLICATE]: 'Duplicate',
      [SuggestionStatus.PLANNED]: 'Planned',
      [SuggestionStatus.IN_PROGRESS]: 'In Progress',
      [SuggestionStatus.COMPLETED]: 'Completed',
      [SuggestionStatus.REJECTED]: 'Rejected',
    };

    const byStatus: Record<string, number> = {};
    for (const status of Object.values(SuggestionStatus)) {
      byStatus[statusToTitleCase[status]] = 0;
    }
    for (const row of grouped) {
      byStatus[statusToTitleCase[row.status]] = row._count.id;
    }

    return { total, byStatus };
  }

  async bulkMerge(
    companyId: string,
    sourceIds: string[],
    targetId: string,
  ): Promise<{
    merged: { id: string }[];
    failed: { id: string; error: string }[];
    target?: Prisma.SuggestionGetPayload<{ include: { author: true; votes: true } }>;
  }> {
    if (sourceIds.includes(targetId)) {
      throw new BadRequestException('targetId must not be in sourceIds');
    }

    const results = await Promise.allSettled(
      sourceIds.map((sourceId) => this.mergeSuggestions(companyId, sourceId, targetId)),
    );

    const merged: { id: string }[] = [];
    const failed: { id: string; error: string }[] = [];

    results.forEach((result, index) => {
      const id = sourceIds[index];
      if (result.status === 'fulfilled') {
        merged.push({ id });
      } else {
        failed.push({
          id,
          error: result.reason?.message ?? String(result.reason),
        });
      }
    });

    let target: Prisma.SuggestionGetPayload<{ include: { author: true; votes: true } }> | undefined;
    if (merged.length > 0) {
      target = await this.findById(companyId, targetId);
    }

    return { merged, failed, target };
  }
}
