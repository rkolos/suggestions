/**
 * Генерирует slug из заголовка.
 * Транслитерация и замена пробелов на дефисы.
 */
export function titleToSlug(title: string): string {
  return (
    title
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9а-яё\-]/gi, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'untitled'
  );
}
