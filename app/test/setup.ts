/**
 * E2E test setup.
 * Загружает .env и устанавливает NODE_ENV=test до загрузки AppModule.
 * Важно: setupFiles выполняются ДО загрузки тестового файла, поэтому env доступен при импорте AppModule.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

// Фиксируем cwd на корень приложения (app/) — Jest worker может иметь другой cwd
const appRoot = path.resolve(__dirname, '..');
if (process.cwd() !== appRoot) {
  process.chdir(appRoot);
}
const envPath = path.join(appRoot, '.env');
dotenv.config({ path: envPath, override: true });
process.env.NODE_ENV = 'test';
