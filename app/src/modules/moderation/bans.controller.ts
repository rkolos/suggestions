import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CompanyIdGuard } from '../../common/guards/company-id.guard';
import { CurrentCompany } from '../../common/decorators/current-company.decorator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { BanUserDto } from './dto/ban-user.dto';
import { BansService } from './bans.service';

type BannedUsersResponse = {
  items: { userId: string; bannedAt: Date }[];
  total: number;
  page: number;
  limit: number;
};

@ApiTags('Bans')
@Controller(['api/v1/bans', 'api/v1/suggestions/bans', 'api/v1/suggestions/banned-users'])
@UseGuards(CompanyIdGuard)
export class BansController {
  constructor(private readonly bansService: BansService) {}

  @Get()
  @ApiOperation({ summary: 'Список забаненных пользователей' })
  @ApiResponse({ status: 200, description: 'Список забаненных' })
  async getBannedUsers(
    @CurrentCompany() companyId: string,
    @Query() query: PaginationQueryDto,
  ): Promise<BannedUsersResponse> {
    return this.bansService.getBannedUsers(companyId, query.page ?? 1, query.limit ?? 20);
  }

  @Post()
  @ApiOperation({ summary: 'Ban пользователя' })
  @ApiResponse({ status: 200, description: 'Пользователь забанен' })
  async banUser(
    @CurrentCompany() companyId: string,
    @Body() body: BanUserDto,
  ): Promise<{ success: boolean }> {
    await this.bansService.banUser(companyId, body.userId);
    return { success: true };
  }

  @Delete(':userId')
  @ApiOperation({ summary: 'Unban пользователя' })
  @ApiResponse({ status: 200, description: 'Пользователь разбанен' })
  async unbanUser(
    @CurrentCompany() companyId: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    await this.bansService.unbanUser(companyId, userId);
  }
}
