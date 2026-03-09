import { SuggestionStatusChangedPayload } from './suggestion-status-changed.event';

/**
 * Выбрасывается при переходе NEW → OPEN.
 * Сигнал для Discord-модуля: создать Embed и Thread.
 */
export type SuggestionPublishedPayload = SuggestionStatusChangedPayload;
