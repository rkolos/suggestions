import * as fs from 'fs';
import * as path from 'path';
import { Writable } from 'stream';

const LOG_FILE = 'dev-debug.md';
const DEV_LOG_TYPES = ['api', 'discord'] as const;

/** Путь к файлу лога: logs/ в корне приложения (cwd при запуске nest start — папка app). */
function getLogPath(): string {
  const appRoot = process.cwd();
  return path.join(appRoot, 'logs', LOG_FILE);
}

let fileInitialized = false;

function ensureFileInit(): void {
  if (fileInitialized) return;
  fileInitialized = true;
  const logPath = getLogPath();
  const dir = path.dirname(logPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (process.env.NODE_ENV === 'test' && fs.existsSync(logPath)) {
    return;
  }
  const header = [
    '# Лог отладки (development)',
    '',
    `Запуск: ${new Date().toISOString()}`,
    '',
    '---',
    '',
    '',
  ].join('\n');
  fs.writeFileSync(logPath, header, 'utf8');
}

/** Синхронная запись блока API в dev-debug.md (для e2e и dev). */
export function appendApiBlockSync(request: unknown, response: unknown): void {
  if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
    return;
  }
  ensureFileInit();
  const block = `\n## API\n\n${formatApiBlock(request, response)}\n`;
  fs.appendFileSync(getLogPath(), block, 'utf8');
}

/** Синхронная запись блока Discord (команда/событие + результат) в dev-debug.md. */
export function appendDiscordBlockSync(payload: Record<string, unknown>): void {
  if (process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test') {
    return;
  }
  ensureFileInit();
  const block = `\n## Discord\n\n${formatDiscordBlock(payload)}\n`;
  fs.appendFileSync(getLogPath(), block, 'utf8');
}

const PINO_META_KEYS = new Set<string>([
  'level',
  'time',
  'pid',
  'hostname',
  'context',
  'req',
  'msg',
  'type',
]);

function isDevLogType(t: unknown): t is (typeof DEV_LOG_TYPES)[number] {
  return typeof t === 'string' && DEV_LOG_TYPES.includes(t as (typeof DEV_LOG_TYPES)[number]);
}

function safeJsonStringify(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

function formatApiBlock(request: unknown, response: unknown): string {
  const requestPart =
    typeof request === 'object' && request !== null ? safeJsonStringify(request) : String(request);
  const responsePart =
    typeof response === 'object' && response !== null
      ? safeJsonStringify(response)
      : String(response);
  return [
    '### Запрос',
    '',
    '```json',
    requestPart,
    '```',
    '',
    '### Ответ',
    '',
    '```json',
    responsePart,
    '```',
    '',
  ].join('\n');
}

function formatDiscordBlock(obj: Record<string, unknown>): string {
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!PINO_META_KEYS.has(key)) {
      filtered[key] = value;
    }
  }
  return ['```json', safeJsonStringify(filtered), '```', ''].join('\n');
}

export function createDevDebugLogStream(): Writable {
  let writeQueue = Promise.resolve<void>(undefined);

  const logPath = getLogPath();

  function appendToFile(md: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.appendFile(logPath, md, 'utf8', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  return new Writable({
    objectMode: false,
    write(
      chunk: Buffer | string,
      encoding: BufferEncoding,
      callback: (error?: Error | null) => void,
    ): void {
      const str = typeof chunk === 'string' ? chunk : chunk.toString('utf8');
      const lines = str.split('\n').filter((line) => line.trim());

      for (const line of lines) {
        let obj: Record<string, unknown>;
        try {
          obj = JSON.parse(line) as Record<string, unknown>;
        } catch {
          continue;
        }

        const type = obj.type;
        if (!isDevLogType(type)) {
          continue;
        }

        writeQueue = writeQueue.then(() => {
          ensureFileInit();
          let block: string;
          if (type === 'api') {
            const request = obj.request;
            const response = obj.response;
            block = `## API\n\n${formatApiBlock(request, response)}\n`;
          } else {
            block = `## Discord\n\n${formatDiscordBlock(obj)}\n\n`;
          }
          return appendToFile(block);
        });
      }

      writeQueue.then(
        () => callback(),
        (err) => callback(err instanceof Error ? err : new Error(String(err))),
      );
    },
  });
}
