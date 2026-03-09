import { Controller, Delete, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { CompanyIdGuard } from '../../common/guards/company-id.guard';
import { CurrentCompany } from '../../common/decorators/current-company.decorator';
import { PrismaService } from '../../common/prisma/prisma.service';

@Controller('api/v1/testing')
@UseGuards(CompanyIdGuard)
export class TestingController {
  constructor(private readonly prisma: PrismaService) {}

  @Delete('teardown')
  @HttpCode(HttpStatus.OK)
  async teardown(@CurrentCompany() companyId: string): Promise<void> {
    await this.prisma.companyConfig.deleteMany({ where: { companyId } });
  }
}
