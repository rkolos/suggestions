import { ExecutionContext } from '@nestjs/common';
import { NecordExecutionContext } from 'necord';
import { DiscordCompanyGuard } from './discord-company.guard';
import { CompanyConfigService } from '../../config/company-config.service';

jest.mock('necord', () => ({
  NecordExecutionContext: {
    create: jest.fn(),
  },
}));

describe('DiscordCompanyGuard', () => {
  let guard: DiscordCompanyGuard;
  let companyConfigService: jest.Mocked<Pick<CompanyConfigService, 'findByDiscordGuildId'>>;

  const createMockInteraction = (
    overrides: Partial<{
      guildId: string | null;
      guild: { id: string } | null;
      isRepliable: boolean;
      reply: jest.Mock;
    }> = {},
  ): Record<string, unknown> & { isRepliable: () => boolean; reply: jest.Mock } => {
    const base = {
      guildId: null as string | null,
      guild: null as { id: string } | null,
      isRepliable: true,
      reply: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    };
    return {
      ...base,
      isRepliable: () => base.isRepliable,
    };
  };

  const createMockDiscovery = (
    overrides: Partial<{
      isSlashCommand: boolean;
      isModal: boolean;
      isMessageComponent: boolean;
    }> = {},
  ): {
    isSlashCommand: () => boolean;
    isModal: () => boolean;
    isMessageComponent: () => boolean;
  } => {
    const base = {
      isSlashCommand: true,
      isModal: false,
      isMessageComponent: false,
      ...overrides,
    };
    return {
      isSlashCommand: () => base.isSlashCommand,
      isModal: () => base.isModal,
      isMessageComponent: () => base.isMessageComponent,
    };
  };

  const createMockContext = (
    type: string,
    interaction: ReturnType<typeof createMockInteraction>,
    discovery: ReturnType<typeof createMockDiscovery>,
  ): ExecutionContext => {
    const args = [[interaction], discovery];
    return {
      getType: (): string => type,
      getArgs: (): unknown[] => args,
      getClass: (): unknown => class {},
      getHandler: (): (() => object) => () => ({}),
      switchToHttp: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    companyConfigService = {
      findByDiscordGuildId: jest.fn(),
    };
    guard = new DiscordCompanyGuard(companyConfigService as never);
    jest.mocked(NecordExecutionContext.create).mockImplementation((ctx: ExecutionContext) => {
      const args = ctx.getArgs();
      return {
        getContext: (): unknown => args[0],
        getDiscovery: (): unknown => args[1],
      } as never;
    });
  });

  it('returns true for non-necord context (HTTP)', async () => {
    const ctx = createMockContext('http', createMockInteraction(), createMockDiscovery());
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(NecordExecutionContext.create).not.toHaveBeenCalled();
  });

  it('returns true when discovery is not slash/modal/messageComponent', async () => {
    const discovery = createMockDiscovery({
      isSlashCommand: false,
      isModal: false,
      isMessageComponent: false,
    });
    const ctx = createMockContext(
      'necord',
      createMockInteraction({ guildId: 'guild-1' }),
      discovery,
    );
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(companyConfigService.findByDiscordGuildId).not.toHaveBeenCalled();
  });

  it('returns true when interaction is missing', async () => {
    const ctx = {
      getType: (): string => 'necord',
      getArgs: (): unknown[] => [[], createMockDiscovery()],
      getClass: (): unknown => class {},
      getHandler: (): (() => object) => () => ({}),
      switchToHttp: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
    } as unknown as ExecutionContext;
    jest.mocked(NecordExecutionContext.create).mockImplementation((c: ExecutionContext) => {
      const args = c.getArgs();
      return {
        getContext: (): unknown => args[0],
        getDiscovery: (): unknown => args[1],
      } as never;
    });
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
  });

  it('returns false and replies ephemeral when guildId is missing (DM)', async () => {
    const interaction = createMockInteraction({ guildId: null, guild: null });
    const ctx = createMockContext('necord', interaction, createMockDiscovery());
    const result = await guard.canActivate(ctx);
    expect(result).toBe(false);
    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'This bot works on Discord servers only. Please run the command in a server.',
      ephemeral: true,
    });
    expect(companyConfigService.findByDiscordGuildId).not.toHaveBeenCalled();
  });

  it('returns false and replies ephemeral when guild is not registered', async () => {
    const interaction = createMockInteraction({ guildId: 'guild-unknown' });
    companyConfigService.findByDiscordGuildId!.mockResolvedValue(null);
    const ctx = createMockContext('necord', interaction, createMockDiscovery());
    const result = await guard.canActivate(ctx);
    expect(result).toBe(false);
    expect(companyConfigService.findByDiscordGuildId).toHaveBeenCalledWith('guild-unknown');
    expect(interaction.reply).toHaveBeenCalledWith({
      content:
        'This server is not set up yet. Please ask an administrator to link this server in the dashboard.',
      ephemeral: true,
    });
  });

  it('returns true and sets companyId when company is found', async () => {
    const interaction = createMockInteraction({ guildId: 'guild-123' });
    companyConfigService.findByDiscordGuildId!.mockResolvedValue({
      companyId: 'company-uuid',
    });
    const ctx = createMockContext('necord', interaction, createMockDiscovery());
    const result = await guard.canActivate(ctx);
    expect(result).toBe(true);
    expect(companyConfigService.findByDiscordGuildId).toHaveBeenCalledWith('guild-123');
    expect((interaction as { companyId?: string }).companyId).toBe('company-uuid');
    expect(interaction.reply).not.toHaveBeenCalled();
  });

  it('does not call reply when interaction is not repliable (no guildId)', async () => {
    const interaction = createMockInteraction({
      guildId: null,
      isRepliable: false,
    });
    const ctx = createMockContext('necord', interaction, createMockDiscovery());
    const result = await guard.canActivate(ctx);
    expect(result).toBe(false);
    expect(interaction.reply).not.toHaveBeenCalled();
  });
});
