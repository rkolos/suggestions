import { SuggestionStatus } from '@prisma/client';
import {
  getNotificationTemplateKey,
  renderNotificationTemplate,
} from './notification-template.util';

describe('renderNotificationTemplate', () => {
  it('replaces {{user}}, {{id}}, {{title}} with values', () => {
    const template = 'Привет, {{user}}! Идея №{{id}}: {{title}}.';
    const vars = { user: 'Alice', id: 'sug-1', title: 'Feature X' };
    expect(renderNotificationTemplate(template, vars)).toBe(
      'Привет, Alice! Идея №sug-1: Feature X.',
    );
  });

  it('replaces missing keys with empty string', () => {
    const template = '{{user}} {{missing}}';
    const vars = { user: 'Bob' };
    expect(renderNotificationTemplate(template, vars)).toBe('Bob ');
  });

  it('handles ticket_merged placeholders', () => {
    const template = '[{{targetTitle}}]({{targetUrl}}) {{targetDescription}}';
    const vars = {
      targetTitle: 'Target',
      targetUrl: 'https://app.example/suggestions/sug-2',
      targetDescription: 'Desc',
    };
    expect(renderNotificationTemplate(template, vars)).toBe(
      '[Target](https://app.example/suggestions/sug-2) Desc',
    );
  });

  it('returns template unchanged when no placeholders', () => {
    const template = 'Plain text';
    expect(renderNotificationTemplate(template, {})).toBe('Plain text');
  });
});

describe('getNotificationTemplateKey', () => {
  it('returns ticket_created for OPEN, IN_PROGRESS, PLANNED', () => {
    expect(getNotificationTemplateKey(SuggestionStatus.OPEN)).toBe('ticket_created');
    expect(getNotificationTemplateKey(SuggestionStatus.IN_PROGRESS)).toBe('ticket_created');
    expect(getNotificationTemplateKey(SuggestionStatus.PLANNED)).toBe('ticket_created');
  });

  it('returns ticket_approved for COMPLETED', () => {
    expect(getNotificationTemplateKey(SuggestionStatus.COMPLETED)).toBe('ticket_approved');
  });

  it('returns ticket_rejected for REJECTED', () => {
    expect(getNotificationTemplateKey(SuggestionStatus.REJECTED)).toBe('ticket_rejected');
  });

  it('returns null for NEW', () => {
    expect(getNotificationTemplateKey(SuggestionStatus.NEW)).toBeNull();
  });

  it('returns ticket_merged for DUPLICATE when mergedInto is provided', () => {
    const mergedInto = {
      id: 'sug-2',
      title: 'Target',
      description: 'Desc',
      discordMessageId: null as string | null,
    };
    expect(getNotificationTemplateKey(SuggestionStatus.DUPLICATE, mergedInto)).toBe(
      'ticket_merged',
    );
  });

  it('returns null for DUPLICATE when mergedInto is not provided', () => {
    expect(getNotificationTemplateKey(SuggestionStatus.DUPLICATE)).toBeNull();
    expect(getNotificationTemplateKey(SuggestionStatus.DUPLICATE, undefined)).toBeNull();
  });
});
