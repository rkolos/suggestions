import { EmbedBuilder } from 'discord.js';
import { SuggestionStatus } from '@prisma/client';

const EMBED_DESCRIPTION_MAX_LENGTH = 4000;
const EMBED_FOOTER_MAX_LENGTH = 2048;

export const STATUS_COLORS: Record<SuggestionStatus, number> = {
  [SuggestionStatus.NEW]: 0x95a5a6,
  [SuggestionStatus.OPEN]: 0xfee75c,
  [SuggestionStatus.IN_PROGRESS]: 0x5865f2,
  [SuggestionStatus.COMPLETED]: 0x57f287,
  [SuggestionStatus.DUPLICATE]: 0x747f8d,
  [SuggestionStatus.REJECTED]: 0xed4245,
  [SuggestionStatus.PLANNED]: 0xeb459e,
};

export const STATUS_LABELS: Record<SuggestionStatus, string> = {
  [SuggestionStatus.NEW]: 'Under review',
  [SuggestionStatus.OPEN]: 'Open for voting',
  [SuggestionStatus.IN_PROGRESS]: 'In progress',
  [SuggestionStatus.COMPLETED]: 'Completed',
  [SuggestionStatus.DUPLICATE]: 'Duplicate',
  [SuggestionStatus.REJECTED]: 'Rejected',
  [SuggestionStatus.PLANNED]: 'Planned',
};

export interface SuggestionEmbedInput {
  title: string;
  description: string;
  status: SuggestionStatus;
  author?: { username: string; avatarUrl: string | null };
  mergedIntoId?: string | null;
  /** URL to the target suggestion's Discord message (for DUPLICATE embed link). */
  mergedIntoMessageUrl?: string | null;
}

export interface BuildSuggestionEmbedOptions {
  userVote?: 1 | -1 | null;
}

export function buildSuggestionEmbed(
  suggestion: SuggestionEmbedInput,
  options?: BuildSuggestionEmbedOptions,
): EmbedBuilder {
  const description =
    suggestion.description.length > EMBED_DESCRIPTION_MAX_LENGTH
      ? suggestion.description.slice(0, EMBED_DESCRIPTION_MAX_LENGTH - 3) + '...'
      : suggestion.description;

  let footerText = STATUS_LABELS[suggestion.status] ?? suggestion.status;
  const userVote = options?.userVote;
  if (userVote != null) {
    const suffix = userVote === 1 ? ' • You: 👍' : ' • You: 👎';
    const candidate = footerText + suffix;
    footerText =
      candidate.length > EMBED_FOOTER_MAX_LENGTH
        ? candidate.slice(0, EMBED_FOOTER_MAX_LENGTH)
        : candidate;
  }

  const embed = new EmbedBuilder()
    .setTitle(suggestion.title)
    .setDescription(description)
    .setColor(STATUS_COLORS[suggestion.status] ?? 0x95a5a6)
    .setFooter({ text: footerText })
    .setTimestamp();

  if (suggestion.author) {
    embed.setAuthor({
      name: suggestion.author.username,
      iconURL: suggestion.author.avatarUrl ?? undefined,
    });
  }

  if (suggestion.status === SuggestionStatus.DUPLICATE && suggestion.mergedIntoId) {
    const value = suggestion.mergedIntoMessageUrl
      ? `Merged into [suggestion \`${suggestion.mergedIntoId}\`](${suggestion.mergedIntoMessageUrl})`
      : `Merged into suggestion \`${suggestion.mergedIntoId}\``;
    embed.addFields({
      name: 'Original',
      value,
    });
  }

  return embed;
}
