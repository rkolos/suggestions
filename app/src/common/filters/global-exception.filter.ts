import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { PinoLogger } from 'nestjs-pino';

interface ErrorResponse {
  error: {
    code: string;
    message: string | string[] | object;
    details: Record<string, unknown>;
    timestamp: string;
    path: string;
  };
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(GlobalExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() !== 'http') {
      const err = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(err.message, err.stack);
      return;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const path = request?.url ?? request?.path ?? '/';
    const timestamp = new Date().toISOString();

    let status: number;
    let code: string;
    let message: string | string[] | object;
    const details: Record<string, unknown> = {};

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const body = exceptionResponse as Record<string, unknown>;
        code = (body.code as string) ?? this.statusToCode(status);
        message = (body.message as string | string[] | object) ?? exception.message;
      } else {
        code = this.statusToCode(status);
        message = String(exceptionResponse);
      }
    } else if (this.isPrismaKnownRequestError(exception)) {
      const prismaError = exception as Prisma.PrismaClientKnownRequestError;
      if (prismaError.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        code = 'DUPLICATE_ENTRY';
        message = 'A record with such data already exists';
      } else if (prismaError.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        code = 'RECORD_NOT_FOUND';
        message = 'Record not found';
      } else {
        status = HttpStatus.INTERNAL_SERVER_ERROR;
        code = 'INTERNAL_ERROR';
        message = 'Internal server error';
        this.logger.error(
          `Prisma error ${prismaError.code}: ${prismaError.message}`,
          prismaError.stack,
        );
      }
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = 'INTERNAL_ERROR';
      message = 'Internal server error';
      const err = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(err.message, err.stack);
    }

    const errorResponse: ErrorResponse = {
      error: {
        code,
        message,
        details,
        timestamp,
        path,
      },
    };

    response.status(status).json(errorResponse);
  }

  private isPrismaKnownRequestError(err: unknown): err is Prisma.PrismaClientKnownRequestError {
    return (
      err !== null &&
      typeof err === 'object' &&
      'code' in err &&
      typeof (err as Prisma.PrismaClientKnownRequestError).code === 'string'
    );
  }

  private statusToCode(status: number): string {
    const map: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.CONFLICT]: 'CONFLICT',
    };
    return map[status] ?? 'UNKNOWN_ERROR';
  }
}
