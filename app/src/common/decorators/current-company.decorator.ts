import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';

export const CurrentCompany = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request & { companyId?: string }>();
    const companyId =
      request.companyId ??
      (request.headers as Record<string, string | string[] | undefined>)['x-company-id'];
    const value = typeof companyId === 'string' ? companyId : companyId?.[0];
    if (!value) {
      throw new Error('CompanyIdGuard must be used when @CurrentCompany() is applied');
    }
    return value;
  },
);
