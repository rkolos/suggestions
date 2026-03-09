import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PinoLogger } from 'nestjs-pino';
import { SuggestionStatusChangedPayload } from '../events/suggestion-status-changed.event';

/**
 * Тестовый слушатель для проверки цепочки событий.
 * В production может быть заменён на Discord-интеграцию и т.п.
 */
@Injectable()
export class SuggestionStatusChangedListener {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(SuggestionStatusChangedListener.name);
  }

  @OnEvent('suggestion.status.changed')
  handleStatusChanged(payload: SuggestionStatusChangedPayload): void {
    this.logger.info(`${payload.suggestionId}: ${payload.oldStatus} → ${payload.newStatus}`);
  }
}
