import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CompanyIdGuard } from '../../common/guards/company-id.guard';
import { CurrentCompany } from '../../common/decorators/current-company.decorator';
import { CompanyConfigService } from '../config/company-config.service';
import { SuggestionsService } from './suggestions.service';
import { SUGGESTIONS_CHANNEL_NOT_CONFIGURED_WARNING } from './constants';
import { BulkDeleteDto } from './dto/bulk-delete.dto';
import { BulkUpdateStatusDto } from './dto/bulk-update-status.dto';
import { BulkMergeDto } from './dto/bulk-merge.dto';
import { SYSTEM_USER_ID } from '../../common/constants';

type SuggestionWithVotes = {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  source: string;
  author: { id: string; username: string; avatarUrl: string | null };
  votes: { type: number }[];
  images?: string[];
  createdAt: Date;
  updatedAt: Date;
};

function toApiFormat(s: SuggestionWithVotes): Record<string, unknown> {
  const upvotes = s.votes.filter((v) => v.type === 1).length;
  const downvotes = s.votes.filter((v) => v.type === -1).length;
  const score = upvotes - downvotes;
  const statusTitle = s.status.charAt(0) + s.status.slice(1).toLowerCase();
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
      images: s.images ?? [],
    },
    metrics: { score, upvotes, downvotes },
    lifecycle: { status: statusTitle },
    created_at: s.createdAt.toISOString(),
    updated_at: s.updatedAt.toISOString(),
  };
}

@ApiTags('Bulk')
@Controller('api/v1/suggestions/bulk')
@UseGuards(CompanyIdGuard)
export class BulkController {
  constructor(
    private readonly suggestionsService: SuggestionsService,
    private readonly configService: CompanyConfigService,
  ) {}

  @Post('delete')
  @ApiOperation({ summary: 'Массовое удаление' })
  @ApiResponse({ status: 200, description: 'Успешно удалено' })
  @ApiResponse({ status: 207, description: 'Частичный успех (часть не удалена)' })
  async bulkDelete(
    @CurrentCompany() companyId: string,
    @Body() body: BulkDeleteDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ deleted: string[]; failed: { id: string; error: string }[] }> {
    const result = await this.suggestionsService.bulkDelete(companyId, body.ids);
    if (result.failed.length > 0) {
      res.status(207);
    }
    return result;
  }

  @Post('status')
  @ApiOperation({ summary: 'Массовое изменение статуса' })
  @ApiResponse({
    status: 200,
    description:
      'Updated. Optional `warning` when suggestions channel is not configured (Discord publish skipped).',
  })
  @ApiResponse({ status: 207, description: 'Частичный успех' })
  async bulkUpdateStatus(
    @CurrentCompany() companyId: string,
    @Body() body: BulkUpdateStatusDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{
    updated: { id: string; suggestion: Record<string, unknown> }[];
    failed: { id: string; error: string }[];
    warning?: string;
  }> {
    const result = await this.suggestionsService.bulkUpdateStatus(
      companyId,
      body.ids,
      body.status as never,
    );
    if (result.failed.length > 0) {
      res.status(207);
    }
    const config = await this.configService.getConfig(companyId);
    const response: {
      updated: { id: string; suggestion: Record<string, unknown> }[];
      failed: { id: string; error: string }[];
      warning?: string;
    } = {
      updated: result.updated.map((u) => ({
        id: u.id,
        suggestion: toApiFormat(u.suggestion as unknown as SuggestionWithVotes),
      })),
      failed: result.failed,
    };
    if (!config.suggestionsChannelId?.trim()) {
      response.warning = SUGGESTIONS_CHANNEL_NOT_CONFIGURED_WARNING;
    }
    return response;
  }

  @Post('merge')
  @ApiOperation({ summary: 'Массовое слияние' })
  @ApiResponse({ status: 200, description: 'Успешно слито' })
  @ApiResponse({ status: 207, description: 'Частичный успех' })
  async bulkMerge(
    @CurrentCompany() companyId: string,
    @Body() body: BulkMergeDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{
    merged: { id: string }[];
    failed: { id: string; error: string }[];
    target?: Record<string, unknown>;
  }> {
    const result = await this.suggestionsService.bulkMerge(
      companyId,
      body.sourceIds,
      body.targetId,
    );
    if (result.failed.length > 0) {
      res.status(207);
    }
    return {
      merged: result.merged,
      failed: result.failed,
      ...(result.target && {
        target: toApiFormat(result.target as unknown as SuggestionWithVotes),
      }),
    };
  }
}
