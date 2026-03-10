import { SuggestionStatus } from '@prisma/client';
import { STATUS_LABELS } from './suggestion-embed.util';

export interface SuggestionForReport {
  id: string;
  title: string;
  status: SuggestionStatus;
  createdAt: Date;
  upvotes?: number;
  downvotes?: number;
  votes?: { type: number }[];
}

const NEXT_STATUS_DESCRIPTIONS: Record<SuggestionStatus, string> = {
  [SuggestionStatus.NEW]: 'It will appear in the channel after an admin approves it.',
  [SuggestionStatus.OPEN]: 'Currently open for voting.',
  [SuggestionStatus.PLANNED]: 'Scheduled for consideration.',
  [SuggestionStatus.IN_PROGRESS]: 'Being worked on.',
  [SuggestionStatus.COMPLETED]: 'Done.',
  [SuggestionStatus.DUPLICATE]: 'Merged into another suggestion.',
  [SuggestionStatus.REJECTED]: 'Not accepted.',
};

export function getNextStatusDescription(status: SuggestionStatus): string {
  return NEXT_STATUS_DESCRIPTIONS[status] ?? '';
}

function getVoteCounts(s: SuggestionForReport): { upvotes: number; downvotes: number } {
  if (typeof s.upvotes === 'number' && typeof s.downvotes === 'number') {
    return { upvotes: s.upvotes, downvotes: s.downvotes };
  }
  if (s.votes?.length) {
    const upvotes = s.votes.filter((v) => v.type === 1).length;
    const downvotes = s.votes.filter((v) => v.type === -1).length;
    return { upvotes, downvotes };
  }
  return { upvotes: 0, downvotes: 0 };
}

export interface FormatSuggestionLineOptions {
  includeVotes?: boolean;
}

/**
 * Formats a single suggestion as a line/block for the myStatus report.
 */
export function formatSuggestionLine(
  suggestion: SuggestionForReport,
  options?: FormatSuggestionLineOptions,
): string {
  const statusLabel = STATUS_LABELS[suggestion.status] ?? suggestion.status;
  const dateStr =
    suggestion.createdAt instanceof Date
      ? suggestion.createdAt.toISOString().slice(0, 10)
      : String(suggestion.createdAt).slice(0, 10);

  let line = `**${suggestion.id}** «${suggestion.title}», created ${dateStr}, status: ${statusLabel}.`;

  const includeVotes = options?.includeVotes !== false;
  if (includeVotes) {
    const { upvotes, downvotes } = getVoteCounts(suggestion);
    if (upvotes > 0 || downvotes > 0) {
      line += ` Votes: ↑ ${upvotes} ↓ ${downvotes}.`;
    }
  }

  line += ` ${getNextStatusDescription(suggestion.status)}`;

  return line;
}

export const MY_STATUS_HINT = 'Use /myStatus to see all your suggestions.';

export const DISCORD_CONTENT_MAX_LENGTH = 2000;
export const DISCORD_EMBED_DESCRIPTION_MAX_LENGTH = 4096;

/**
 * Builds the full report text for multiple suggestions. If total length exceeds maxLength,
 * returns an array of chunks that fit within the limit.
 */
export function buildReportChunks(
  suggestions: SuggestionForReport[],
  maxLength: number = DISCORD_CONTENT_MAX_LENGTH,
): string[] {
  if (suggestions.length === 0) {
    return [];
  }

  const lines = suggestions.map((s) => formatSuggestionLine(s, { includeVotes: true }));
  const chunks: string[] = [];
  let current = '';

  for (const line of lines) {
    const withNewline = current ? current + '\n\n' + line : line;
    if (withNewline.length <= maxLength) {
      current = withNewline;
    } else {
      if (current) {
        chunks.push(current);
      }
      current = line.length <= maxLength ? line : line.slice(0, maxLength - 3) + '...';
    }
  }
  if (current) {
    chunks.push(current);
  }

  return chunks;
}
