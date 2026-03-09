import './env-loader';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { Logger } from 'nestjs-pino';
import { AppModule } from './../src/app.module';
import { ApiLogInterceptor } from '../src/common/dev-log/api-log.interceptor';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ bufferLogs: true });
    app.useLogger(app.get(Logger));
    if (process.env.NODE_ENV === 'test') {
      app.useGlobalInterceptors(app.get(ApiLogInterceptor));
    }
    await app.init();
  }, 15000);

  afterAll(async () => {
    await app.close();
    // Даём Discord client время на отключение перед следующим suite
    await new Promise((r) => setTimeout(r, 1000));
  });

  it('/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('status', 'ok');
        expect(res.body).toHaveProperty('timestamp');
      });
  });

  it('returns unified error format for 404', () => {
    return request(app.getHttpServer())
      .get('/nonexistent-route')
      .expect(404)
      .expect((res) => {
        expect(res.body).toHaveProperty('error');
        expect(res.body.error).toHaveProperty('code');
        expect(res.body.error).toHaveProperty('message');
        expect(res.body.error).toHaveProperty('details');
        expect(res.body.error).toHaveProperty('timestamp');
        expect(res.body.error).toHaveProperty('path');
      });
  });

  it('rejects request to protected route without X-Company-Id with 400', () => {
    return request(app.getHttpServer())
      .get('/context')
      .expect(400)
      .expect((res) => {
        expect(res.body.error.message).toBe('Missing Company Context');
      });
  });

  it('returns companyId and userId when X-Company-Id and X-User-Id are provided', () => {
    return request(app.getHttpServer())
      .get('/context')
      .set('X-Company-Id', 'company-uuid-123')
      .set('X-User-Id', 'user-discord-456')
      .expect(200)
      .expect((res) => {
        expect(res.body).toEqual({
          companyId: 'company-uuid-123',
          userId: 'user-discord-456',
        });
      });
  });

  it('returns companyId with undefined userId when only X-Company-Id is provided', () => {
    return request(app.getHttpServer())
      .get('/context')
      .set('X-Company-Id', 'company-uuid-789')
      .expect(200)
      .expect((res) => {
        expect(res.body.companyId).toBe('company-uuid-789');
        expect(res.body.userId).toBeUndefined();
      });
  });

  it('GET /api/v1/suggestions/config returns config with X-Company-Id', () => {
    return request(app.getHttpServer())
      .get('/api/v1/suggestions/config')
      .set('X-Company-Id', '00000000-0000-0000-0000-000000000001')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('categories');
        expect(res.body).toHaveProperty('notifications');
      });
  });

  it('GET /api/v1/suggestions/config/defaults returns defaults with 5 categories', () => {
    return request(app.getHttpServer())
      .get('/api/v1/suggestions/config/defaults')
      .set('X-Company-Id', '00000000-0000-0000-0000-000000000001')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('notifications');
        expect(res.body.notifications).toHaveProperty('ticket_created');
        expect(res.body.notifications).toHaveProperty('ticket_merged');
        expect(res.body).toHaveProperty('categories');
        expect(Array.isArray(res.body.categories)).toBe(true);
        expect(res.body.categories.length).toBe(5);
        const ids = res.body.categories.map((c: { id: string }) => c.id);
        expect(ids).toContain('general');
        expect(ids).toContain('feature-request');
        expect(ids).toContain('improvement');
        expect(ids).toContain('bug-report');
        expect(ids).toContain('other');
      });
  });

  it('GET /api/v1/users/me rejects request without X-Company-Id with 400', () => {
    return request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('X-User-Id', 'user_A_123')
      .expect(400)
      .expect((res) => {
        expect(res.body.error.message).toBe('Missing Company Context');
      });
  });

  it('GET /api/v1/users/me rejects request without X-User-Id with 400', () => {
    return request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('X-Company-Id', '00000000-0000-0000-0000-000000000001')
      .expect(400)
      .expect((res) => {
        expect(res.body.error.message).toBe('X-User-Id required');
      });
  });

  it('GET /api/v1/users/me returns 200 with id when user exists or not', () => {
    return request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('X-Company-Id', '00000000-0000-0000-0000-000000000001')
      .set('X-User-Id', 'user_A_123')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('id', 'user_A_123');
        expect(typeof res.body.id).toBe('string');
      });
  });
});
