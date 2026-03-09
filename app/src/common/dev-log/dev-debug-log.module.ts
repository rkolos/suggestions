import pino from 'pino';
import { Module } from '@nestjs/common';
import { ApiLogInterceptor } from './api-log.interceptor';
import { createDevDebugLogStream } from './dev-debug-log.stream';
import { DEV_DEBUG_API_LOGGER } from './dev-debug-log.tokens';

@Module({
  providers: [
    ApiLogInterceptor,
    {
      provide: DEV_DEBUG_API_LOGGER,
      useFactory: (): pino.Logger | null => {
        const nodeEnv = process.env.NODE_ENV;
        if (nodeEnv !== 'development' && nodeEnv !== 'test') {
          return null;
        }
        const stream = createDevDebugLogStream();
        return pino({ level: 'info' }, stream);
      },
    },
  ],
  exports: [ApiLogInterceptor, DEV_DEBUG_API_LOGGER],
})
export class DevDebugLogModule {}
