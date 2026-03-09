import { SuggestionStatus } from '@prisma/client';

export interface SuggestionStatusChangedPayload {
  companyId: string;
  suggestionId: string;
  oldStatus: SuggestionStatus;
  newStatus: SuggestionStatus;
  suggestion: {
    id: string;
    companyId: string;
    authorId: string;
    title: string;
    description: string;
    category: string;
    status: SuggestionStatus;
    discordMessageId?: string | null;
    discordThreadId?: string | null;
    mergedIntoId?: string | null;
    author?: { username: string; avatarUrl: string | null };
    [key: string]: unknown;
  };
}
