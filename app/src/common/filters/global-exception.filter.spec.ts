import { HttpStatus, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ArgumentsHost } from '@nestjs/common/interfaces';
import { GlobalExceptionFilter } from './global-exception.filter';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockLogger: { error: jest.Mock; setContext: jest.Mock };

  const createMockHost = (
    url = '/test',
  ): { host: ArgumentsHost; mockResponse: { status: jest.Mock; json: jest.Mock } } => {
    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const mockRequest = { url, path: url };
    const host = {
      getType: (): 'http' => 'http',
      switchToHttp: (): {
        getResponse: () => typeof mockResponse;
        getRequest: () => typeof mockRequest;
      } => ({
        getResponse: (): typeof mockResponse => mockResponse,
        getRequest: (): typeof mockRequest => mockRequest,
      }),
    } as unknown as ArgumentsHost;
    return { host, mockResponse };
  };

  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
      setContext: jest.fn(),
    };
    filter = new GlobalExceptionFilter(mockLogger as never);
  });

  it('handles HttpException (404) with unified format', () => {
    const { host, mockResponse } = createMockHost('/api/v1/suggestions/sug_123');

    filter.catch(new NotFoundException('Not Found'), host);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'NOT_FOUND',
          message: 'Not Found',
          details: {},
          timestamp: expect.any(String),
          path: '/api/v1/suggestions/sug_123',
        }),
      }),
    );
  });

  it('handles Prisma P2002 as 409 DUPLICATE_ENTRY', () => {
    const { host, mockResponse } = createMockHost('/test');
    const prismaError = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '5.0.0',
    });

    filter.catch(prismaError, host);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'DUPLICATE_ENTRY',
          message: 'A record with such data already exists',
          path: '/test',
        }),
      }),
    );
  });

  it('handles Prisma P2025 as 404 RECORD_NOT_FOUND', () => {
    const { host, mockResponse } = createMockHost('/test');
    const prismaError = new Prisma.PrismaClientKnownRequestError('Record to update not found', {
      code: 'P2025',
      clientVersion: '5.0.0',
    });

    filter.catch(prismaError, host);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'RECORD_NOT_FOUND',
          message: 'Record not found',
        }),
      }),
    );
  });

  it('handles unknown Error as 500 and logs without exposing details', () => {
    const { host, mockResponse } = createMockHost('/test');
    const error = new Error('Sensitive SQL details');

    filter.catch(error, host);

    expect(mockLogger.error).toHaveBeenCalledWith('Sensitive SQL details', expect.any(String));
    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
        }),
      }),
    );
  });
});
