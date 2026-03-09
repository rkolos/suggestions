import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BansService } from '../moderation/bans.service';
import { CommentsService } from '../comments/comments.service';
import { SuggestionsService } from './suggestions.service';
import { SuggestionStatus } from '@prisma/client';

describe('SuggestionsService', () => {
  let service: SuggestionsService;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  const mockPrisma = {
    user: { upsert: jest.fn() },
    suggestion: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const mockBansService = { assertNotBanned: jest.fn().mockResolvedValue(undefined) };
    const mockCommentsService = { create: jest.fn().mockResolvedValue({}) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuggestionsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: BansService, useValue: mockBansService },
        { provide: CommentsService, useValue: mockCommentsService },
      ],
    }).compile();

    service = module.get(SuggestionsService);
    eventEmitter = module.get(EventEmitter2);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findById', () => {
    it('throws NotFoundException when suggestion not found', async () => {
      mockPrisma.suggestion.findFirst.mockResolvedValue(null);

      await expect(service.findById('company-1', 'sug_xxx')).rejects.toThrow(NotFoundException);
    });

    it('returns suggestion when found', async () => {
      const mockSuggestion = {
        id: 'sug_abc',
        companyId: 'company-1',
        authorId: 'user-1',
        title: 'Test',
        author: {},
        votes: [],
      };
      mockPrisma.suggestion.findFirst.mockResolvedValue(mockSuggestion);

      const result = await service.findById('company-1', 'sug_abc');
      expect(result).toEqual(mockSuggestion);
      expect(mockPrisma.suggestion.findFirst).toHaveBeenCalledWith({
        where: { companyId: 'company-1', id: 'sug_abc' },
        include: { author: true, votes: true },
      });
    });
  });

  describe('create', () => {
    it('calls ensureUser before create', async () => {
      mockPrisma.suggestion.findFirst.mockResolvedValue(null);
      mockPrisma.suggestion.create.mockResolvedValue({
        id: 'sug_xxx',
        companyId: 'company-1',
        authorId: 'user-new',
      } as never);

      await service.create('company-1', 'user-new', {
        title: 'Test',
        description: 'Desc',
        category: 'UI',
      });

      expect(mockPrisma.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-new' },
          create: expect.objectContaining({
            id: 'user-new',
            username: expect.any(String),
          }),
        }),
      );
    });

    it('emits suggestion.created event', async () => {
      mockPrisma.suggestion.findFirst.mockResolvedValue(null);
      const created = { id: 'sug_xxx', companyId: 'company-1' };
      mockPrisma.suggestion.create.mockResolvedValue(created as never);

      await service.create('company-1', 'user-1', {
        title: 'Test',
        description: 'Desc',
        category: 'UI',
      });

      expect(eventEmitter.emit).toHaveBeenCalledWith('suggestion.created', created);
    });
  });

  describe('updateStatus', () => {
    it('emits suggestion.status.changed when status changes', async () => {
      const existing = {
        id: 'sug_abc',
        companyId: 'company-1',
        status: SuggestionStatus.NEW,
        author: {},
        votes: [],
      };
      const updated = { ...existing, status: SuggestionStatus.OPEN };
      mockPrisma.suggestion.findFirst.mockResolvedValue(existing as never);
      mockPrisma.suggestion.update.mockResolvedValue(updated as never);

      await service.updateStatus('company-1', 'sug_abc', SuggestionStatus.OPEN);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'suggestion.status.changed',
        expect.objectContaining({
          companyId: 'company-1',
          suggestionId: 'sug_abc',
          oldStatus: SuggestionStatus.NEW,
          newStatus: SuggestionStatus.OPEN,
        }),
      );
    });

    it('emits suggestion.published when NEW → OPEN', async () => {
      const existing = {
        id: 'sug_abc',
        companyId: 'company-1',
        status: SuggestionStatus.NEW,
        author: {},
        votes: [],
      };
      mockPrisma.suggestion.findFirst.mockResolvedValue(existing as never);
      mockPrisma.suggestion.update.mockResolvedValue({
        ...existing,
        status: SuggestionStatus.OPEN,
      } as never);

      await service.updateStatus('company-1', 'sug_abc', SuggestionStatus.OPEN);

      expect(eventEmitter.emit).toHaveBeenCalledWith('suggestion.published', expect.any(Object));
    });

    it('returns existing without update when status unchanged', async () => {
      const existing = {
        id: 'sug_abc',
        companyId: 'company-1',
        status: SuggestionStatus.OPEN,
        author: {},
        votes: [],
      };
      mockPrisma.suggestion.findFirst.mockResolvedValue(existing as never);

      const result = await service.updateStatus('company-1', 'sug_abc', SuggestionStatus.OPEN);

      expect(result).toEqual(existing);
      expect(mockPrisma.suggestion.update).not.toHaveBeenCalled();
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('emits suggestion.deleted and deletes when discord ids present', async () => {
      const suggestion = {
        id: 'sug_abc',
        companyId: 'company-1',
        discordMessageId: 'msg-123',
        discordThreadId: 'thread-456',
        author: {},
        votes: [],
      };
      mockPrisma.suggestion.findFirst.mockResolvedValue(suggestion as never);
      mockPrisma.suggestion.delete.mockResolvedValue(undefined as never);

      await service.delete('company-1', 'sug_abc');

      expect(eventEmitter.emit).toHaveBeenCalledWith('suggestion.deleted', {
        companyId: 'company-1',
        suggestionId: 'sug_abc',
        discordMessageId: 'msg-123',
        discordThreadId: 'thread-456',
      });
      expect(mockPrisma.suggestion.delete).toHaveBeenCalledWith({
        where: { id: 'sug_abc', companyId: 'company-1' },
      });
    });

    it('does not emit suggestion.deleted when no discord ids', async () => {
      const suggestion = {
        id: 'sug_abc',
        companyId: 'company-1',
        discordMessageId: null,
        discordThreadId: null,
        author: {},
        votes: [],
      };
      mockPrisma.suggestion.findFirst.mockResolvedValue(suggestion as never);
      mockPrisma.suggestion.delete.mockResolvedValue(undefined as never);

      await service.delete('company-1', 'sug_abc');

      expect(eventEmitter.emit).not.toHaveBeenCalled();
      expect(mockPrisma.suggestion.delete).toHaveBeenCalled();
    });

    it('throws when suggestion not found', async () => {
      mockPrisma.suggestion.findFirst.mockResolvedValue(null);

      await expect(service.delete('company-1', 'sug_xxx')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.suggestion.delete).not.toHaveBeenCalled();
    });
  });

  describe('bulkDelete', () => {
    it('emits suggestion.deleted for each suggestion with discord ids and deletes all', async () => {
      mockPrisma.suggestion.findMany.mockResolvedValue([
        { id: 'sug_1', discordMessageId: 'msg-1', discordThreadId: null },
        { id: 'sug_2', discordMessageId: null, discordThreadId: 'thread-2' },
        { id: 'sug_3', discordMessageId: null, discordThreadId: null },
      ] as never);
      mockPrisma.suggestion.deleteMany.mockResolvedValue({ count: 3 } as never);

      const result = await service.bulkDelete('company-1', ['sug_1', 'sug_2', 'sug_3']);

      expect(eventEmitter.emit).toHaveBeenCalledTimes(2);
      expect(eventEmitter.emit).toHaveBeenCalledWith('suggestion.deleted', {
        companyId: 'company-1',
        suggestionId: 'sug_1',
        discordMessageId: 'msg-1',
        discordThreadId: null,
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith('suggestion.deleted', {
        companyId: 'company-1',
        suggestionId: 'sug_2',
        discordMessageId: null,
        discordThreadId: 'thread-2',
      });
      expect(mockPrisma.suggestion.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ['sug_1', 'sug_2', 'sug_3'] }, companyId: 'company-1' },
      });
      expect(result.deleted).toEqual(['sug_1', 'sug_2', 'sug_3']);
    });

    it('does not emit when no suggestions have discord ids', async () => {
      mockPrisma.suggestion.findMany.mockResolvedValue([
        { id: 'sug_1', discordMessageId: null, discordThreadId: null },
      ] as never);
      mockPrisma.suggestion.deleteMany.mockResolvedValue({ count: 1 } as never);

      const result = await service.bulkDelete('company-1', ['sug_1']);

      expect(eventEmitter.emit).not.toHaveBeenCalled();
      expect(result.deleted).toEqual(['sug_1']);
    });
  });
});
