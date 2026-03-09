import type { Logger } from 'pino';
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  HttpException,
  HttpStatus,
  Optional,
  Inject,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { DEV_DEBUG_API_LOGGER } from './dev-debug-log.tokens';
import { appendApiBlockSync } from './dev-debug-log.stream';

@Injectable()
export class ApiLogInterceptor implements NestInterceptor {
  constructor(
    @Optional()
    @Inject(DEV_DEBUG_API_LOGGER)
    private readonly devDebugLogger: Logger | null,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv !== 'development' && nodeEnv !== 'test') {
      return next.handle();
    }

    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const requestInfo = {
      method: request.method,
      path: request.url ?? request.path ?? '',
      query: request.query,
      body: request.body,
      headers: {
        'x-company-id': request.headers?.['x-company-id'],
        'x-user-id': request.headers?.['x-user-id'],
      },
    };

    return next.handle().pipe(
      tap((data) => {
        const responseData = { statusCode: response.statusCode, body: data };
        appendApiBlockSync(requestInfo, responseData);
        this.devDebugLogger?.info({
          type: 'api',
          request: requestInfo,
          response: responseData,
        });
      }),
      catchError((err: unknown) => {
        const errorResponse = this.formatErrorResponse(err);
        appendApiBlockSync(requestInfo, errorResponse);
        this.devDebugLogger?.info({
          type: 'api',
          request: requestInfo,
          response: errorResponse,
        });
        return throwError(() => err);
      }),
    );
  }

  private formatErrorResponse(err: unknown): { statusCode: number; body: unknown } {
    if (err instanceof HttpException) {
      const status = err.getStatus();
      const res = err.getResponse();
      const body =
        typeof res === 'object' && res !== null
          ? res
          : { message: typeof res === 'string' ? res : String(res) };
      return { statusCode: status, body };
    }
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}
