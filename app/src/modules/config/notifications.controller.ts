import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CompanyIdGuard } from '../../common/guards/company-id.guard';
import { CurrentCompany } from '../../common/decorators/current-company.decorator';
import { CompanyConfigService } from './company-config.service';
import { NotificationTemplatesDto } from './dto/update-config.dto';

@ApiTags('Notifications')
@Controller('api/v1/suggestions/settings/notifications')
@UseGuards(CompanyIdGuard)
export class NotificationsController {
  constructor(private readonly configService: CompanyConfigService) {}

  @Get()
  @ApiOperation({ summary: 'Получение шаблонов уведомлений' })
  @ApiResponse({ status: 200, description: 'Шаблоны уведомлений' })
  getNotifications(@CurrentCompany() companyId: string): Promise<Record<string, string>> {
    return this.configService.getNotifications(companyId);
  }

  @Put()
  @ApiOperation({ summary: 'Обновление шаблонов уведомлений' })
  @ApiResponse({ status: 200, description: 'Обновлённые шаблоны' })
  updateNotifications(
    @CurrentCompany() companyId: string,
    @Body() body: NotificationTemplatesDto,
  ): Promise<Record<string, string>> {
    const notifications: Record<string, string> = {};
    if (body.ticket_created !== undefined) notifications.ticket_created = body.ticket_created;
    if (body.ticket_approved !== undefined) notifications.ticket_approved = body.ticket_approved;
    if (body.ticket_rejected !== undefined) notifications.ticket_rejected = body.ticket_rejected;
    return this.configService.updateNotifications(companyId, notifications);
  }
}
