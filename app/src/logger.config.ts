import pino from 'pino';
import type { Params } from 'nestjs-pino';
import { createDevDebugLogStream } from './common/dev-log/dev-debug-log.stream';

const isDevOrTest = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';

async function buildPinoHttp(): Promise<Params['pinoHttp']> {
  if (isDevOrTest) {
    const prettyStream = await pino.transport({
      target: 'pino-pretty',
      options: { colorize: true },
    });
    return {
      level: 'debug',
      stream: pino.multistream([{ stream: prettyStream }, { stream: createDevDebugLogStream() }]),
    };
  }
  return {
    level: process.env.NODE_ENV !== 'production' ? 'debug' : 'info',
    transport:
      process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  };
}

export async function getLoggerConfig(): Promise<Params> {
  return {
    pinoHttp: await buildPinoHttp(),
  };
}
