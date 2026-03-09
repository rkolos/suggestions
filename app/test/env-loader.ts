/**
 * Загружает .env до любых других импортов.
 * Импортировать первой строкой в каждом E2E-файле.
 * Используем process.cwd() — при npm run test:e2e cwd = app/
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath, override: true });
process.env.NODE_ENV = 'test';
if (!process.env.AI_SERVICE_URL?.trim()) {
  process.env.AI_SERVICE_URL = 'http://ai-mock';
}
