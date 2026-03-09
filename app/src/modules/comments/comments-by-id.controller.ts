import { Body, Controller, Delete, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { CompanyIdGuard } from '../../common/guards/company-id.guard';
import { CurrentCompany } from '../../common/decorators/current-company.decorator';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { CommentsService } from './comments.service';

type CommentWithAuthor = Prisma.CommentGetPayload<{ include: { author: true } }>;

@ApiTags('Comments')
@Controller('api/v1/suggestions/comments')
@UseGuards(CompanyIdGuard)
export class CommentsByIdController {
  constructor(private readonly commentsService: CommentsService) {}

  @Patch(':commentId')
  @ApiOperation({ summary: 'Редактирование комментария' })
  @ApiResponse({ status: 200, description: 'Обновлённый комментарий' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async update(
    @CurrentCompany() companyId: string,
    @Param('commentId') commentId: string,
    @Body() body: UpdateCommentDto,
  ): Promise<CommentWithAuthor> {
    return this.commentsService.update(companyId, commentId, body.body);
  }

  @Delete(':commentId')
  @ApiOperation({ summary: 'Удаление комментария' })
  @ApiResponse({ status: 200, description: 'Удалено' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async delete(
    @CurrentCompany() companyId: string,
    @Param('commentId') commentId: string,
  ): Promise<void> {
    await this.commentsService.delete(companyId, commentId);
  }
}
