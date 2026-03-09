import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CompanyIdGuard } from '../../common/guards/company-id.guard';
import { CurrentCompany } from '../../common/decorators/current-company.decorator';
import { CompanyConfigService } from './company-config.service';
import { UpdateConfigDto } from './dto/update-config.dto';

@ApiTags('Config')
@Controller('api/v1/suggestions/config')
@UseGuards(CompanyIdGuard)
export class ConfigController {
  constructor(private readonly configService: CompanyConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Получение настроек (Categories, Notifications)' })
  @ApiResponse({ status: 200, description: 'Настройки' })
  getConfig(@CurrentCompany() companyId: string): Promise<{
    categories: unknown[];
    notifications: Record<string, string>;
    suggestionsChannelId: string | null;
  }> {
    return this.configService.getConfig(companyId);
  }

  @Put()
  @ApiOperation({ summary: 'Обновление настроек' })
  @ApiResponse({ status: 200, description: 'Обновлённые настройки' })
  updateConfig(
    @CurrentCompany() companyId: string,
    @Body() body: UpdateConfigDto,
  ): Promise<{
    categories: unknown[];
    notifications: Record<string, string>;
    suggestionsChannelId: string | null;
  }> {
    return this.configService.updateConfig(companyId, body);
  }

  @Get('defaults')
  @ApiOperation({ summary: 'Дефолтные шаблоны для Reset to Default' })
  @ApiResponse({ status: 200, description: 'Дефолтные настройки' })
  getDefaults(): {
    categories: { id: string; label: string; color: string }[];
    notifications: Record<string, string>;
  } {
    return this.configService.getDefaultConfig();
  }
}
