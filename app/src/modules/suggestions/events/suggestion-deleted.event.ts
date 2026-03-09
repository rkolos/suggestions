export interface SuggestionDeletedPayload {
  companyId: string;
  suggestionId: string;
  discordMessageId: string | null;
  discordThreadId: string | null;
}
