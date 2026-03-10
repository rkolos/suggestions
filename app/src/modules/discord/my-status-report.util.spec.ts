import { SuggestionStatus } from '@prisma/client';
import {
  getNextStatusDescription,
  formatSuggestionLine,
  buildReportChunks,
  MY_STATUS_HINT,
  type SuggestionForReport,
} from './my-status-report.util';

describe('getNextStatusDescription', () => {
  it('returns description for NEW', () => {
    expect(getNextStatusDescription(SuggestionStatus.NEW)).toBe(
      'It will appear in the channel after an admin approves it.',
    );
  });

  it('returns description for OPEN', () => {
    expect(getNextStatusDescription(SuggestionStatus.OPEN)).toBe('Currently open for voting.');
  });

  it('returns description for REJECTED', () => {
    expect(getNextStatusDescription(SuggestionStatus.REJECTED)).toBe('Not accepted.');
  });

  it('returns description for COMPLETED', () => {
    expect(getNextStatusDescription(SuggestionStatus.COMPLETED)).toBe('Done.');
  });

  it('returns description for all statuses', () => {
    const statuses: SuggestionStatus[] = [
      SuggestionStatus.NEW,
      SuggestionStatus.OPEN,
      SuggestionStatus.PLANNED,
      SuggestionStatus.IN_PROGRESS,
      SuggestionStatus.COMPLETED,
      SuggestionStatus.DUPLICATE,
      SuggestionStatus.REJECTED,
    ];
    for (const status of statuses) {
      expect(getNextStatusDescription(status)).toBeTruthy();
      expect(typeof getNextStatusDescription(status)).toBe('string');
    }
  });
});

describe('formatSuggestionLine', () => {
  const baseSuggestion: SuggestionForReport = {
    id: 'sug_abc123',
    title: 'Add dark mode',
    status: SuggestionStatus.NEW,
    createdAt: new Date('2025-03-01T12:00:00.000Z'),
  };

  it('includes id, title, date and status label', () => {
    const line = formatSuggestionLine(baseSuggestion);
    expect(line).toContain('**sug_abc123**');
    expect(line).toContain('«Add dark mode»');
    expect(line).toContain('created 2025-03-01');
    expect(line).toContain('Under review');
    expect(line).toContain('It will appear in the channel after an admin approves it.');
  });

  it('includes vote counts when upvotes/downvotes are set', () => {
    const withVotes = {
      ...baseSuggestion,
      status: SuggestionStatus.OPEN,
      upvotes: 5,
      downvotes: 2,
    };
    const line = formatSuggestionLine(withVotes);
    expect(line).toContain('Votes: ↑ 5 ↓ 2.');
  });

  it('includes vote counts from votes array when upvotes/downvotes not set', () => {
    const withVotesArray = {
      ...baseSuggestion,
      status: SuggestionStatus.OPEN,
      votes: [{ type: 1 }, { type: 1 }, { type: -1 }],
    };
    const line = formatSuggestionLine(withVotesArray);
    expect(line).toContain('Votes: ↑ 2 ↓ 1.');
  });

  it('omits vote block when includeVotes is false and no votes', () => {
    const line = formatSuggestionLine(baseSuggestion, { includeVotes: false });
    expect(line).not.toContain('Votes:');
  });

  it('omits vote block when votes are zero', () => {
    const line = formatSuggestionLine({ ...baseSuggestion, upvotes: 0, downvotes: 0 });
    expect(line).not.toContain('Votes: ↑ 0 ↓ 0');
  });
});

describe('buildReportChunks', () => {
  const makeSuggestion = (id: string, title: string): SuggestionForReport => ({
    id,
    title,
    status: SuggestionStatus.OPEN,
    createdAt: new Date('2025-03-01T12:00:00.000Z'),
    upvotes: 1,
    downvotes: 0,
  });

  it('returns empty array for empty suggestions', () => {
    expect(buildReportChunks([])).toEqual([]);
  });

  it('returns one chunk when all lines fit within maxLength', () => {
    const suggestions = [makeSuggestion('sug_1', 'First'), makeSuggestion('sug_2', 'Second')];
    const chunks = buildReportChunks(suggestions, 2000);
    expect(chunks.length).toBe(1);
    expect(chunks[0]).toContain('**sug_1**');
    expect(chunks[0]).toContain('**sug_2**');
  });

  it('splits into multiple chunks when content exceeds maxLength', () => {
    const suggestions = [makeSuggestion('sug_1', 'First'), makeSuggestion('sug_2', 'Second')];
    const chunks = buildReportChunks(suggestions, 80);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    expect(chunks.every((c) => c.length <= 80 || c.endsWith('...'))).toBe(true);
  });
});

describe('MY_STATUS_HINT', () => {
  it('contains myStatus command reference', () => {
    expect(MY_STATUS_HINT).toContain('/myStatus');
  });
});
