import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CompanyIdGuard } from '../../common/guards/company-id.guard';
import { CurrentCompany } from '../../common/decorators/current-company.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { SuggestionsService } from './suggestions.service';
import { VotesService, ToggleVoteResult } from '../votes/votes.service';
import { GetSuggestionsQueryDto } from './dto/get-suggestions-query.dto';
import { CreateSuggestionBodyDto } from './dto/create-suggestion-body.dto';
import { UpdateSuggestionBodyDto } from './dto/update-suggestion-body.dto';
import { UpdateSuggestionStatusDto } from './dto/update-status.dto';
import { VoteDto } from './dto/vote.dto';
import { SimilarRequestDto } from './dto/similar-request.dto';
import { AiIntegrationService } from '../ai-integration/ai-integration.service';
import { SYSTEM_USER_ID } from '../../common/constants';

type SuggestionWithVotes = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  source: string;
  author: { id: string; username: string; avatarUrl: string | null };
  votes: { userId: string; type: number }[];
  createdAt: Date;
  updatedAt: Date;
  upvotes?: number;
  downvotes?: number;
  mergedIntoId?: string | null;
};

function toDuplicatesFormat(s: SuggestionWithVotes): Record<string, unknown> {
  const hasPrecomputedMetrics = typeof s.upvotes === 'number' && typeof s.downvotes === 'number';
  const upvotes = hasPrecomputedMetrics ? s.upvotes! : s.votes.filter((v) => v.type === 1).length;
  const downvotes = hasPrecomputedMetrics
    ? s.downvotes!
    : s.votes.filter((v) => v.type === -1).length;
  const statusTitle = s.status.charAt(0) + s.status.slice(1).toLowerCase();
  return {
    id: s.id,
    title: s.title,
    status: statusTitle,
    matchScore: null,
    excerpt: s.description.slice(0, 200),
    upvotes,
    downvotes,
  };
}

function toApiFormat(s: SuggestionWithVotes, userId?: string): Record<string, unknown> {
  const hasPrecomputedMetrics = typeof s.upvotes === 'number' && typeof s.downvotes === 'number';
  const upvotes = hasPrecomputedMetrics ? s.upvotes! : s.votes.filter((v) => v.type === 1).length;
  const downvotes = hasPrecomputedMetrics
    ? s.downvotes!
    : s.votes.filter((v) => v.type === -1).length;
  const score = upvotes - downvotes;
  const statusTitle = s.status.charAt(0) + s.status.slice(1).toLowerCase();
  const userVote =
    userId != null ? (s.votes.find((v) => v.userId === userId)?.type ?? null) : undefined;
  return {
    id: s.id,
    source: s.source.toLowerCase(),
    author: {
      id: s.author.id,
      username: s.author.username,
      avatar_url: s.author.avatarUrl ?? '',
      isSystem: s.author.id === SYSTEM_USER_ID,
    },
    content: {
      title: s.title,
      description: s.description,
      category: s.category,
      images: (s as SuggestionWithVotes & { images?: string[] }).images ?? [],
    },
    metrics: { score, upvotes, downvotes },
    lifecycle: {
      status: statusTitle,
      ...(s.mergedIntoId && { merged_into: s.mergedIntoId }),
    },
    ...(userId != null && { user_vote: userVote ?? null }),
    created_at: s.createdAt.toISOString(),
    updated_at: s.updatedAt.toISOString(),
  };
}

@ApiTags('Suggestions')
@Controller('api/v1/suggestions')
@UseGuards(CompanyIdGuard)
export class SuggestionsController {
  constructor(
    private readonly suggestionsService: SuggestionsService,
    private readonly votesService: VotesService,
    private readonly aiIntegrationService: AiIntegrationService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Список предложений с фильтрами и пагинацией' })
  @ApiResponse({ status: 200, description: 'Список предложений' })
  async findAll(
    @CurrentCompany() companyId: string,
    @CurrentUser() userId: string | undefined,
    @Query() query: GetSuggestionsQueryDto,
  ): Promise<{ items: Record<string, unknown>[]; total: number; page: number; limit: number }> {
    const result = await this.suggestionsService.findAll(
      companyId,
      {
        page: query.page,
        limit: query.limit,
        status: query.status,
        category: query.category,
        authorId: query.authorId,
        sort: query.sort,
        order: query.order,
      },
      userId,
    );
    return {
      items: result.items.map((s) => toApiFormat(s as SuggestionWithVotes, userId)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Счётчики по статусам' })
  @ApiResponse({ status: 200, description: 'Статистика по статусам' })
  async getStats(
    @CurrentCompany() companyId: string,
  ): Promise<{ total: number; byStatus: Record<string, number> }> {
    return this.suggestionsService.getStats(companyId);
  }

  @Get(':id/duplicates')
  @ApiOperation({ summary: 'Похожие предложения для вкладки Duplicates' })
  @ApiResponse({ status: 200, description: 'Список похожих или dismissed: true' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getDuplicates(
    @CurrentCompany() companyId: string,
    @CurrentUser() userId: string | undefined,
    @Param('id') id: string,
  ): Promise<
    { dismissed?: boolean; items?: Record<string, unknown>[] } | Record<string, unknown>[]
  > {
    const suggestion = await this.suggestionsService.findById(companyId, id, userId);
    const dismissed = (suggestion as SuggestionWithVotes & { dismissedDuplicatesAt?: Date | null })
      .dismissedDuplicatesAt;
    if (dismissed) {
      return { dismissed: true, items: [] };
    }
    const text = `${suggestion.title}\n${suggestion.description}`;
    const ids = await this.aiIntegrationService.findSimilar(companyId, text);
    const filteredIds = ids.filter((sid) => sid !== id);
    if (filteredIds.length === 0) return [];
    const items = await this.suggestionsService.findByIds(companyId, filteredIds, userId);
    return items.map((s) => toDuplicatesFormat(s as SuggestionWithVotes));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Детальная панель предложения' })
  @ApiResponse({ status: 200, description: 'Предложение' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async findById(
    @CurrentCompany() companyId: string,
    @CurrentUser() userId: string | undefined,
    @Param('id') id: string,
  ): Promise<Record<string, unknown>> {
    const suggestion = await this.suggestionsService.findById(companyId, id, userId);
    return toApiFormat(suggestion as unknown as SuggestionWithVotes, userId);
  }

  @Post()
  @ApiOperation({ summary: 'Создание предложения' })
  @ApiResponse({ status: 201, description: 'Созданное предложение' })
  @ApiResponse({ status: 400, description: 'X-User-Id required' })
  async create(
    @CurrentCompany() companyId: string,
    @CurrentUser() userId: string | undefined,
    @Body() body: CreateSuggestionBodyDto,
  ): Promise<Record<string, unknown>> {
    const authorId = body.isOfficial && body.authorId ? body.authorId : (userId ?? '');
    if (!authorId) {
      throw new BadRequestException('X-User-Id required for creating suggestions');
    }
    const suggestion = await this.suggestionsService.create(companyId, authorId, {
      title: body.title,
      description: body.description,
      category: body.category,
      isOfficial: body.isOfficial,
      source: body.source === 'discord' ? 'DISCORD' : 'WEB',
      images: body.images,
    });
    return toApiFormat(suggestion as unknown as SuggestionWithVotes, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Обновление предложения (статус, категория)' })
  @ApiResponse({ status: 200, description: 'Обновлённое предложение' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async update(
    @CurrentCompany() companyId: string,
    @Param('id') id: string,
    @Body() body: UpdateSuggestionBodyDto,
  ): Promise<Record<string, unknown>> {
    const suggestion = await this.suggestionsService.update(companyId, id, {
      title: body.title,
      description: body.description,
      category: body.category,
      images: body.images,
    });
    return toApiFormat(suggestion as unknown as SuggestionWithVotes);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Изменение статуса предложения' })
  @ApiResponse({ status: 200, description: 'Обновлённое предложение' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async updateStatus(
    @CurrentCompany() companyId: string,
    @Param('id') id: string,
    @Body() body: UpdateSuggestionStatusDto,
  ): Promise<Record<string, unknown>> {
    const suggestion = await this.suggestionsService.updateStatus(
      companyId,
      id,
      body.status as never,
      body.comment,
    );
    return toApiFormat(suggestion as unknown as SuggestionWithVotes);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Удаление предложения' })
  @ApiResponse({ status: 200, description: 'Удалено' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async delete(@CurrentCompany() companyId: string, @Param('id') id: string): Promise<void> {
    await this.suggestionsService.delete(companyId, id);
  }

  @Post('similar')
  @ApiOperation({ summary: 'Поиск похожих предложений по тексту (модалка создания)' })
  @ApiResponse({ status: 200, description: 'Массив похожих предложений' })
  async findSimilar(
    @CurrentCompany() companyId: string,
    @CurrentUser() userId: string | undefined,
    @Body() body: SimilarRequestDto,
  ): Promise<Record<string, unknown>[]> {
    const ids = await this.aiIntegrationService.findSimilar(companyId, body.text);
    if (ids.length === 0) return [];
    const items = await this.suggestionsService.findByIds(companyId, ids, userId);
    return items.map((s) => toApiFormat(s as SuggestionWithVotes, userId));
  }

  @Post('merge')
  @ApiOperation({ summary: 'Слияние предложений (sourceId → targetId)' })
  @ApiResponse({ status: 200, description: 'Результат слияния' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async merge(
    @CurrentCompany() companyId: string,
    @Body() body: { sourceId: string; targetId: string },
  ): Promise<{ source: Record<string, unknown>; target: Record<string, unknown> }> {
    const source = await this.suggestionsService.mergeSuggestions(
      companyId,
      body.sourceId,
      body.targetId,
    );
    const target = await this.suggestionsService.findById(companyId, body.targetId);
    return {
      source: toApiFormat(source as unknown as SuggestionWithVotes),
      target: toApiFormat(target as unknown as SuggestionWithVotes),
    };
  }

  @Post(':id/dismiss-duplicates')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Отклонение блока "похожие" (кнопка "Похожих нет")' })
  @ApiResponse({ status: 204, description: 'No Content' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async dismissDuplicates(
    @CurrentCompany() companyId: string,
    @Param('id') id: string,
  ): Promise<void> {
    await this.suggestionsService.dismissDuplicates(companyId, id);
  }

  @Post(':id/vote')
  @ApiOperation({ summary: 'Голосование upvote/downvote' })
  @ApiResponse({ status: 200, description: 'Результат голосования' })
  @ApiResponse({ status: 400, description: 'X-User-Id required' })
  async vote(
    @CurrentCompany() companyId: string,
    @CurrentUser() userId: string | undefined,
    @Param('id') id: string,
    @Body() body: VoteDto,
  ): Promise<ToggleVoteResult> {
    if (!userId) {
      throw new BadRequestException('X-User-Id required for voting');
    }
    const type = body.vote === 'upvote' ? 1 : -1;
    return this.votesService.toggleVote(companyId, userId, id, type);
  }

  @Get(':id/discord-preview')
  @ApiOperation({ summary: 'Discord Preview: payload/embed для предпросмотра' })
  @ApiResponse({ status: 200, description: 'Embed для Discord' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async discordPreview(
    @CurrentCompany() companyId: string,
    @Param('id') id: string,
  ): Promise<{ embeds: unknown[] }> {
    const suggestion = await this.suggestionsService.findById(companyId, id);
    const upvotes = (suggestion as SuggestionWithVotes).votes.filter((v) => v.type === 1).length;
    const downvotes = (suggestion as SuggestionWithVotes).votes.filter((v) => v.type === -1).length;
    const score = upvotes - downvotes;
    const statusTitle = suggestion.status.charAt(0) + suggestion.status.slice(1).toLowerCase();
    return {
      embeds: [
        {
          title: `#${suggestion.id} — ${suggestion.title}`,
          description: suggestion.description.slice(0, 2000),
          color: 3447003,
          fields: [
            { name: 'Status', value: statusTitle, inline: true },
            { name: 'Score', value: String(score), inline: true },
          ],
          footer: { text: 'Suggestions' },
        },
      ],
    };
  }
}
