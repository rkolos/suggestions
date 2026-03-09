import { SuggestionStatus } from '@prisma/client';

/**
 * Substitutes variables into the template. Substrings {{key}} are replaced with vars[key];
 * missing keys yield an empty string.
 */
export function renderNotificationTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
}

const STATUS_TO_TEMPLATE_KEY: Record<SuggestionStatus, string | null> = {
  [SuggestionStatus.NEW]: null,
  [SuggestionStatus.OPEN]: 'ticket_created',
  [SuggestionStatus.IN_PROGRESS]: 'ticket_created',
  [SuggestionStatus.PLANNED]: 'ticket_created',
  [SuggestionStatus.COMPLETED]: 'ticket_approved',
  [SuggestionStatus.REJECTED]: 'ticket_rejected',
  [SuggestionStatus.DUPLICATE]: 'ticket_merged',
};

/**
 * Returns the notification template key for the new status.
 * For DUPLICATE returns 'ticket_merged' only when mergedInto (merge) is provided.
 */
export function getNotificationTemplateKey(
  newStatus: SuggestionStatus,
  mergedInto?: { id: string; title: string; description: string; discordMessageId: string | null },
): string | null {
  const key = STATUS_TO_TEMPLATE_KEY[newStatus];
  if (newStatus === SuggestionStatus.DUPLICATE && !mergedInto) {
    return null;
  }
  return key;
}
