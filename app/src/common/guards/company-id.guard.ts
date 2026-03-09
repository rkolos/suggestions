import { CanActivate, ExecutionContext, Injectable, BadRequestException } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class CompanyIdGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const companyId = request.headers['x-company-id'];

    if (!companyId || (typeof companyId === 'string' && !companyId.trim())) {
      throw new BadRequestException('Missing Company Context');
    }

    const value = typeof companyId === 'string' ? companyId : companyId[0];
    (request as Request & { companyId?: string }).companyId = value;

    return true;
  }
}
