import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { NecordExecutionContext } from 'necord';
import type { Interaction } from 'discord.js';

export const DiscordCompany = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    if ((ctx.getType() as string) !== 'necord') {
      throw new Error('@DiscordCompany() can only be used in Discord command handlers');
    }

    const necordContext = NecordExecutionContext.create(ctx);
    const [interaction] = necordContext.getContext<[Interaction]>() ?? [];

    if (!interaction) {
      throw new Error('DiscordCompanyGuard must be used when @DiscordCompany() is applied');
    }

    const companyId = (interaction as Interaction & { companyId?: string }).companyId;
    if (!companyId) {
      throw new Error('DiscordCompanyGuard must be used when @DiscordCompany() is applied');
    }

    return companyId;
  },
);
