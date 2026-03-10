import { Test, TestingModule } from '@nestjs/testing';
import { SuggestionStatus } from '@prisma/client';
import { MyStatusCommand } from './my-status.command';
import { BansService } from '../../moderation/bans.service';
import { SuggestionsService } from '../../suggestions/suggestions.service';

describe('MyStatusCommand', () => {
  let command: MyStatusCommand;
  let bansService: jest.Mocked<Pick<BansService, 'isBanned'>>;
  let suggestionsService: jest.Mocked<Pick<SuggestionsService, 'findAll'>>;

  beforeEach(async () => {
    bansService = { isBanned: jest.fn() };
    suggestionsService = {
      findAll: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MyStatusCommand,
        { provide: BansService, useValue: bansService },
        { provide: SuggestionsService, useValue: suggestionsService },
      ],
    }).compile();

    command = module.get(MyStatusCommand);
  });

  it('should be defined', () => {
    expect(command).toBeDefined();
  });

  describe('onMyStatus', () => {
    const mockReply = jest.fn().mockResolvedValue(undefined);
    const mockFollowUp = jest.fn().mockResolvedValue(undefined);
    const mockInteraction = {
      user: { id: 'user-123' },
      reply: mockReply,
      followUp: mockFollowUp,
    };
    const mockCompanyId = 'company-uuid';

    beforeEach(() => {
      mockReply.mockClear();
      mockFollowUp.mockClear();
    });

    it('replies with banned message when user is banned', async () => {
      bansService.isBanned.mockResolvedValue(true);

      await command.onMyStatus([mockInteraction as never], mockCompanyId);

      expect(bansService.isBanned).toHaveBeenCalledWith(mockCompanyId, 'user-123');
      expect(suggestionsService.findAll).not.toHaveBeenCalled();
      expect(mockReply).toHaveBeenCalledTimes(1);
      expect(mockReply).toHaveBeenCalledWith({
        content: 'You are banned from submitting suggestions and voting on this server.',
        ephemeral: true,
      });
    });

    it('replies with no-suggestions message when user has no suggestions', async () => {
      bansService.isBanned.mockResolvedValue(false);
      suggestionsService.findAll.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        limit: 50,
      });

      await command.onMyStatus([mockInteraction as never], mockCompanyId);

      expect(suggestionsService.findAll).toHaveBeenCalledWith(
        mockCompanyId,
        expect.objectContaining({
          authorId: 'user-123',
          limit: 50,
          sort: 'createdAt',
          order: 'desc',
        }),
        'user-123',
      );
      expect(mockReply).toHaveBeenCalledWith({
        content: 'You have no suggestions yet. Use /suggest to create one.',
        ephemeral: true,
      });
    });

    it('replies with report when user has suggestions', async () => {
      bansService.isBanned.mockResolvedValue(false);
      type FindAllResult = Awaited<ReturnType<SuggestionsService['findAll']>>;
      const partialResult = {
        items: [
          {
            id: 'sug_1',
            title: 'Test suggestion',
            status: SuggestionStatus.OPEN,
            createdAt: new Date('2025-03-01T12:00:00.000Z'),
            upvotes: 2,
            downvotes: 0,
            votes: [],
          },
        ],
        total: 1,
        page: 1,
        limit: 50,
      };
      suggestionsService.findAll.mockResolvedValue(partialResult as unknown as FindAllResult);

      await command.onMyStatus([mockInteraction as never], mockCompanyId);

      expect(mockReply).toHaveBeenCalledTimes(1);
      expect(mockReply.mock.calls[0][0].content).toContain('**Your suggestions**');
      expect(mockReply.mock.calls[0][0].content).toContain('sug_1');
      expect(mockReply.mock.calls[0][0].content).toContain('Test suggestion');
      expect(mockReply.mock.calls[0][0].ephemeral).toBe(true);
    });
  });
});
