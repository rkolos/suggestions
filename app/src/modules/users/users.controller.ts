import { BadRequestException, Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CompanyIdGuard } from '../../common/guards/company-id.guard';
import { CurrentCompany } from '../../common/decorators/current-company.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsersService, MeResponse } from './users.service';

@ApiTags('Users')
@Controller('api/v1/users')
@UseGuards(CompanyIdGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Current user: id, username, avatarUrl, role, permissions' })
  @ApiResponse({ status: 200, description: 'User data' })
  @ApiResponse({ status: 400, description: 'X-User-Id required' })
  async getMe(
    @CurrentCompany() companyId: string,
    @CurrentUser() userId: string | undefined,
  ): Promise<MeResponse> {
    if (!userId) {
      throw new BadRequestException('X-User-Id required');
    }
    return this.usersService.getMe(companyId, userId);
  }
}
