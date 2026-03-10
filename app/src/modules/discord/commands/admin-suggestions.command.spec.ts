import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SuggestionStatus } from '@prisma/client';
import { AdminSuggestionsCommand } from './admin-suggestions.command';
import { SuggestionsService } from '../../suggestions/suggestions.service';

describe('AdminSuggestionsCommand', () => {
  let command: AdminSuggestionsCommand;
  let suggestionsService: jest.Mocked<
    Pick<SuggestionsService, 'findById' | 'findByDiscordThreadId' | 'updateStatus'>
  >;

  const companyId = 'company-1';
  const mockReply = jest.fn().mockResolvedValue(undefined);

  beforeEach(async () => {
    suggestionsService = {
      findById: jest.fn(),
      findByDiscordThreadId: jest.fn(),
      updateStatus: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminSuggestionsCommand,
        { provide: SuggestionsService, useValue: suggestionsService },
      ],
    }).compile();

    command = module.get(AdminSuggestionsCommand);
    mockReply.mockClear();
  });

  it('should be defined', () => {
    expect(command).toBeDefined();
  });

  describe('onApprove', () => {
    it('approves by suggestion_id and replies with success', async () => {
      suggestionsService.findById.mockResolvedValue({
        id: 'sug_123',
        companyId,
        author: {},
        votes: [],
      } as never);

      const interaction = {
        channel: null,
        reply: mockReply,
      };

      await command.onApprove([interaction as never], companyId, { suggestion_id: 'sug_123' });

      expect(suggestionsService.findById).toHaveBeenCalledWith(companyId, 'sug_123');
      expect(suggestionsService.updateStatus).toHaveBeenCalledWith(
        companyId,
        'sug_123',
        SuggestionStatus.OPEN,
      );
      expect(mockReply).toHaveBeenCalledWith({
        content: 'Suggestion approved.',
        ephemeral: true,
      });
    });

    it('approves by thread when used in thread without suggestion_id', async () => {
      suggestionsService.findByDiscordThreadId.mockResolvedValue({
        id: 'sug_thread',
        companyId,
        author: {},
        votes: [],
      } as never);

      const interaction = {
        channel: { id: 'thread-456', isThread: (): boolean => true },
        reply: mockReply,
      };

      await command.onApprove([interaction as never], companyId, {});

      expect(suggestionsService.findByDiscordThreadId).toHaveBeenCalledWith(
        companyId,
        'thread-456',
      );
      expect(suggestionsService.updateStatus).toHaveBeenCalledWith(
        companyId,
        'sug_thread',
        SuggestionStatus.OPEN,
      );
      expect(mockReply).toHaveBeenCalledWith({
        content: 'Suggestion approved.',
        ephemeral: true,
      });
    });

    it('replies with provide-id-or-thread message when no suggestion_id and not in thread', async () => {
      const interaction = {
        channel: null,
        reply: mockReply,
      };

      await command.onApprove([interaction as never], companyId, {});

      expect(suggestionsService.findById).not.toHaveBeenCalled();
      expect(suggestionsService.findByDiscordThreadId).not.toHaveBeenCalled();
      expect(suggestionsService.updateStatus).not.toHaveBeenCalled();
      expect(mockReply).toHaveBeenCalledWith({
        content: 'Provide a suggestion ID or use this command inside a suggestion thread.',
        ephemeral: true,
      });
    });

    it('replies with suggestion not found when findById throws', async () => {
      suggestionsService.findById.mockRejectedValue(new NotFoundException('Not found'));

      const interaction = {
        channel: null,
        reply: mockReply,
      };

      await command.onApprove([interaction as never], companyId, { suggestion_id: 'sug_bad' });

      expect(mockReply).toHaveBeenCalledWith({
        content: 'Suggestion not found.',
        ephemeral: true,
      });
    });
  });

  describe('onReject', () => {
    it('rejects by suggestion_id and replies with success', async () => {
      suggestionsService.findById.mockResolvedValue({
        id: 'sug_456',
        companyId,
        author: {},
        votes: [],
      } as never);

      const interaction = {
        channel: null,
        reply: mockReply,
      };

      await command.onReject([interaction as never], companyId, { suggestion_id: 'sug_456' });

      expect(suggestionsService.findById).toHaveBeenCalledWith(companyId, 'sug_456');
      expect(suggestionsService.updateStatus).toHaveBeenCalledWith(
        companyId,
        'sug_456',
        SuggestionStatus.REJECTED,
      );
      expect(mockReply).toHaveBeenCalledWith({
        content: 'Suggestion rejected.',
        ephemeral: true,
      });
    });

    it('replies with provide-id-or-thread message when no suggestion_id and not in thread', async () => {
      const interaction = {
        channel: null,
        reply: mockReply,
      };

      await command.onReject([interaction as never], companyId, {});

      expect(mockReply).toHaveBeenCalledWith({
        content: 'Provide a suggestion ID or use this command inside a suggestion thread.',
        ephemeral: true,
      });
    });
  });
});
