import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx
      .switchToHttp()
      .getRequest<{ headers: Record<string, string | string[] | undefined> }>();
    const userId = request.headers['x-user-id'];
    if (!userId) return undefined;
    return typeof userId === 'string' ? userId : userId[0];
  },
);
