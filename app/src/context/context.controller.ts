import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CompanyIdGuard } from '../common/guards/company-id.guard';
import { CurrentCompany } from '../common/decorators/current-company.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Context')
@Controller('context')
@UseGuards(CompanyIdGuard)
export class ContextController {
  @Get()
  @ApiOperation({ summary: 'Context: companyId, userId' })
  @ApiResponse({ status: 200, description: 'Current request context' })
  getContext(
    @CurrentCompany() companyId: string,
    @CurrentUser() userId?: string,
  ): { companyId: string; userId?: string } {
    return { companyId, userId };
  }
}
