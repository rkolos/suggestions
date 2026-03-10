import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { CompanyIdGuard } from '../../common/guards/company-id.guard';
import { CurrentCompany } from '../../common/decorators/current-company.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CommentsService } from './comments.service';

type CommentWithAuthor = Prisma.CommentGetPayload<{ include: { author: true } }>;
type CommentsListResponse = {
  items: CommentWithAuthor[];
  total: number;
  page: number;
  limit: number;
};

@ApiTags('Comments')
@Controller('api/v1/suggestions/:suggestionId/comments')
@UseGuards(CompanyIdGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  @ApiOperation({ summary: 'Team Chat — list comments' })
  @ApiResponse({ status: 200, description: 'List of comments' })
  async findBySuggestionId(
    @CurrentCompany() companyId: string,
    @Param('suggestionId') suggestionId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<CommentsListResponse> {
    return this.commentsService.findBySuggestionId(
      companyId,
      suggestionId,
      query.page ?? 1,
      query.limit ?? 20,
    );
  }

  @Post()
  @ApiOperation({ summary: 'Team Chat — post comment' })
  @ApiResponse({ status: 201, description: 'Created comment' })
  @ApiResponse({ status: 400, description: 'X-User-Id required' })
  async create(
    @CurrentCompany() companyId: string,
    @Param('suggestionId') suggestionId: string,
    @CurrentUser() userId: string | undefined,
    @Body() body: CreateCommentDto,
  ): Promise<CommentWithAuthor> {
    const authorId = userId;
    if (!authorId) {
      throw new BadRequestException('X-User-Id required for creating comments');
    }
    return this.commentsService.create(
      companyId,
      suggestionId,
      authorId,
      body.body,
      body.isInternal ?? true,
    );
  }
}
