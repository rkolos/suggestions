import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { PinoLogger } from 'nestjs-pino';
import { SuggestionStatus } from '@prisma/client';
import { DiscordPublishService, DISCORD_PUBLISH_QUEUE } from './discord-publish.service';
import { SuggestionStatusChangedPayload } from '../suggestions/events/suggestion-status-changed.event';

describe('DiscordPublishService', () => {
  let service: DiscordPublishService;
  let queueAdd: jest.Mock;

  const createPayload = (
    overrides: Partial<SuggestionStatusChangedPayload> = {},
  ): SuggestionStatusChangedPayload => ({
    companyId: 'company-1',
    suggestionId: 'sug_abc',
    oldStatus: SuggestionStatus.NEW,
    newStatus: SuggestionStatus.OPEN,
    suggestion: {
      id: 'sug_abc',
      companyId: 'company-1',
      authorId: 'user-1',
      title: 'Test',
      description: 'Description',
      category: 'UI',
      status: SuggestionStatus.OPEN,
      author: { username: 'testuser', avatarUrl: 'https://example.com/avatar.png' },
    },
    ...overrides,
  });

  beforeEach(async () => {
    queueAdd = jest.fn().mockResolvedValue({ id: 'job-1' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscordPublishService,
        {
          provide: getQueueToken(DISCORD_PUBLISH_QUEUE),
          useValue: { add: queueAdd },
        },
        {
          provide: PinoLogger,
          useValue: { setContext: jest.fn(), error: jest.fn(), info: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(DiscordPublishService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('adds job to queue when newStatus is not NEW', () => {
    const payload = createPayload({ newStatus: SuggestionStatus.OPEN });
    service.handleStatusChanged(payload);

    expect(queueAdd).toHaveBeenCalledTimes(1);
    expect(queueAdd).toHaveBeenCalledWith(
      'publish',
      expect.objectContaining({
        companyId: 'company-1',
        suggestionId: 'sug_abc',
        oldStatus: SuggestionStatus.NEW,
        newStatus: SuggestionStatus.OPEN,
        suggestion: expect.objectContaining({
          id: 'sug_abc',
          title: 'Test',
          author: { username: 'testuser', avatarUrl: 'https://example.com/avatar.png' },
        }),
      }),
    );
  });

  it('adds job when newStatus is COMPLETED', () => {
    const payload = createPayload({
      newStatus: SuggestionStatus.COMPLETED,
      oldStatus: SuggestionStatus.OPEN,
      suggestion: {
        ...createPayload().suggestion,
        status: SuggestionStatus.COMPLETED,
      },
    });
    service.handleStatusChanged(payload);

    expect(queueAdd).toHaveBeenCalledTimes(1);
    expect(queueAdd).toHaveBeenCalledWith(
      'publish',
      expect.objectContaining({ newStatus: SuggestionStatus.COMPLETED }),
    );
  });

  it('does not add job when newStatus is NEW', () => {
    const payload = createPayload({ newStatus: SuggestionStatus.NEW });
    service.handleStatusChanged(payload);

    expect(queueAdd).not.toHaveBeenCalled();
  });

  describe('handleSuggestionDeleted', () => {
    it('adds delete job when discordMessageId or discordThreadId present', () => {
      service.handleSuggestionDeleted({
        companyId: 'company-1',
        suggestionId: 'sug_abc',
        discordMessageId: 'msg-123',
        discordThreadId: 'thread-456',
      });

      expect(queueAdd).toHaveBeenCalledTimes(1);
      expect(queueAdd).toHaveBeenCalledWith(
        'delete',
        expect.objectContaining({
          companyId: 'company-1',
          suggestionId: 'sug_abc',
          discordMessageId: 'msg-123',
          discordThreadId: 'thread-456',
        }),
      );
    });

    it('does not add job when both discord ids are null', () => {
      service.handleSuggestionDeleted({
        companyId: 'company-1',
        suggestionId: 'sug_abc',
        discordMessageId: null,
        discordThreadId: null,
      });

      expect(queueAdd).not.toHaveBeenCalled();
    });
  });
});
