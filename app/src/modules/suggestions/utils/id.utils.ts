import { randomBytes } from 'crypto';

/**
 * Генерирует уникальный ID с префиксом.
 * sug_ — обычные предложения, prop- — официальные посты.
 */
export function generateSuggestionId(isOfficial: boolean): string {
  const prefix = isOfficial ? 'prop-' : 'sug_';
  const suffix = randomBytes(8).toString('hex');
  return `${prefix}${suffix}`;
}
