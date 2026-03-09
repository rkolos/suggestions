import './env-loader';
import { randomUUID } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { MockAgent, setGlobalDispatcher, fetch as undiciFetch } from 'undici';
import { Logger } from 'nestjs-pino';
import { AppModule } from '../src/app.module';
import { ApiLogInterceptor } from '../src/common/dev-log/api-log.interceptor';
import { PrismaService } from '../src/common/prisma/prisma.service';

describe('Suggestions (e2e)', () => {
  let app: INestApplication;
  const companyId = randomUUID();
  let aiMockAgent: MockAgent;
  let originalFetch: typeof globalThis.fetch;

  beforeAll(async () => {
    aiMockAgent = new MockAgent();
    setGlobalDispatcher(aiMockAgent);
    originalFetch = globalThis.fetch;
    (globalThis as unknown as { fetch: typeof fetch }).fetch =
      undiciFetch as unknown as typeof fetch;

    const aiMockPool = aiMockAgent.get('http://ai-mock');
    aiMockPool.intercept({ path: '/rag/sync', method: 'POST' }).reply(200, '{}').persist();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ bufferLogs: true });
    app.useLogger(app.get(Logger));
    if (process.env.NODE_ENV === 'test') {
      app.useGlobalInterceptors(app.get(ApiLogInterceptor));
    }
    await app.init();

    // Подключаем канал Discord для e2e: в логах и в Discord будут сообщения о публикации
    const channelId = process.env.DISCORD_DEVELOPMENT_CHANNEL_ID?.trim();
    if (channelId) {
      const prisma = app.get(PrismaService);
      await prisma.companyConfig.upsert({
        where: { companyId },
        create: {
          companyId,
          suggestionsChannelId: channelId,
        },
        update: {
          suggestionsChannelId: channelId,
        },
      });
    }
  }, 15000);

  afterAll(async () => {
    (globalThis as unknown as { fetch: typeof fetch }).fetch = originalFetch;
    await request(app.getHttpServer())
      .delete('/api/v1/testing/teardown')
      .set('X-Company-Id', companyId)
      .expect(200);
    await app.close();
    // Даём Discord client время на отключение перед следующим suite
    await new Promise((r) => setTimeout(r, 2000));
  });

  it('/health (GET) should return 200', () => {
    return request(app.getHttpServer()).get('/health').expect(200);
  });

  describe('Scenario A: User Flow', () => {
    const USER_A = 'user_A_123';
    const USER_B = 'user_B_456';

    const headers = (userId: string): Record<string, string> => ({
      'X-Company-Id': companyId,
      'X-User-Id': userId,
      'Content-Type': 'application/json',
    });

    it('полный сценарий: создание, голосование, toggle, users/me', async () => {
      const server = app.getHttpServer();

      // Подготовка: создать CompanyConfig (upsert через GET config)
      await request(server)
        .get('/api/v1/suggestions/config')
        .set('X-Company-Id', companyId)
        .expect(200);

      // Шаг 1: Создание предложения (User A)
      const createRes = await request(server)
        .post('/api/v1/suggestions')
        .set(headers(USER_A))
        .send({
          title: 'E2E тестовая идея',
          description: 'Описание для Scenario A',
          category: 'Улучшения',
          images: ['https://example.com/1.png', 'https://example.com/2.png'],
        })
        .expect(201);

      const createdSuggestionId = createRes.body.id;
      expect(createdSuggestionId).toBeDefined();
      expect(createRes.body.lifecycle?.status).toBe('New');

      // Шаг 2: PATCH status → OPEN (перед голосованием)
      await request(server)
        .patch(`/api/v1/suggestions/${createdSuggestionId}/status`)
        .set(headers(USER_A))
        .send({ status: 'OPEN' })
        .expect(200);

      // Шаг 3: GET /api/v1/suggestions (User B)
      const listRes = await request(server)
        .get('/api/v1/suggestions')
        .set(headers(USER_B))
        .expect(200);

      expect(listRes.body.items.length).toBeGreaterThanOrEqual(1);
      const foundItem = listRes.body.items.find(
        (item: { id: string }) => item.id === createdSuggestionId,
      );
      expect(foundItem).toBeDefined();
      expect(foundItem.user_vote).toBeNull();

      // Шаг 4: POST vote upvote (User B)
      const vote1Res = await request(server)
        .post(`/api/v1/suggestions/${createdSuggestionId}/vote`)
        .set(headers(USER_B))
        .send({ vote: 'upvote' });
      expect([200, 201]).toContain(vote1Res.status);

      expect(vote1Res.body.upvotes).toBe(1);
      expect(vote1Res.body.downvotes).toBe(0);

      // Шаг 5: GET /api/v1/suggestions/:id (User B) — проверка userVote
      const detailRes = await request(server)
        .get(`/api/v1/suggestions/${createdSuggestionId}`)
        .set(headers(USER_B))
        .expect(200);

      expect(detailRes.body.user_vote).toBe(1);

      // Шаг 6: POST vote upvote (User A)
      const vote2Res = await request(server)
        .post(`/api/v1/suggestions/${createdSuggestionId}/vote`)
        .set(headers(USER_A))
        .send({ vote: 'upvote' });
      expect([200, 201]).toContain(vote2Res.status);

      expect(vote2Res.body.upvotes).toBe(2);
      expect(vote2Res.body.downvotes).toBe(0);

      // Шаг 7: POST vote downvote (User B) — Toggle
      const vote3Res = await request(server)
        .post(`/api/v1/suggestions/${createdSuggestionId}/vote`)
        .set(headers(USER_B))
        .send({ vote: 'downvote' });
      expect([200, 201]).toContain(vote3Res.status);

      expect(vote3Res.body.upvotes).toBe(1);
      expect(vote3Res.body.downvotes).toBe(1);

      // Шаг 8: GET /api/v1/users/me (User A)
      const meRes = await request(server)
        .get('/api/v1/users/me')
        .set('X-Company-Id', companyId)
        .set('X-User-Id', USER_A)
        .expect(200);

      expect(meRes.body.id).toBe('user_A_123');
    });
  });

  describe('Scenario B: Admin Flow', () => {
    const USER_A = 'user_A_123';
    const USER_B = 'user_B_456';
    const ADMIN = 'admin_999';

    let suggestionId: string;

    const headers = (userId: string): Record<string, string> => ({
      'X-Company-Id': companyId,
      'X-User-Id': userId,
      'Content-Type': 'application/json',
    });

    beforeAll(async () => {
      const server = app.getHttpServer();

      await request(server)
        .get('/api/v1/suggestions/config')
        .set('X-Company-Id', companyId)
        .expect(200);

      // Создать admin в users (CommentsService требует authorId в таблице users)
      await request(server)
        .post('/api/v1/suggestions')
        .set(headers(ADMIN))
        .send({
          title: 'dummy для создания admin',
          description: 'd',
          category: 'Улучшения',
          images: [],
        })
        .expect(201);

      const createRes = await request(server)
        .post('/api/v1/suggestions')
        .set(headers(USER_A))
        .send({
          title: 'E2E идея для модерации',
          description: 'Описание для Scenario B',
          category: 'Улучшения',
          images: [],
        })
        .expect(201);

      suggestionId = createRes.body.id;
      expect(suggestionId).toBeDefined();
    });

    it('полный сценарий: модерация, комментарии, бан, разбан', async () => {
      const server = app.getHttpServer();

      // Шаг 1: Смена статуса (admin)
      const statusRes = await request(server)
        .patch(`/api/v1/suggestions/${suggestionId}/status`)
        .set(headers(ADMIN))
        .send({ status: 'OPEN' })
        .expect(200);

      expect(statusRes.body.lifecycle?.status).toBe('Open');

      // Шаг 2: Внутренний комментарий (Team Chat)
      await request(server)
        .post(`/api/v1/suggestions/${suggestionId}/comments`)
        .set(headers(ADMIN))
        .send({
          body: 'Проверил, берем в работу',
          isInternal: true,
        })
        .expect(201);

      const commentsAfterInternal = await request(server)
        .get(`/api/v1/suggestions/${suggestionId}/comments`)
        .set('X-Company-Id', companyId)
        .expect(200);

      const internalComment = commentsAfterInternal.body.items.find(
        (c: { body: string; isInternal: boolean }) =>
          c.body === 'Проверил, берем в работу' && c.isInternal === true,
      );
      expect(internalComment).toBeDefined();

      // Шаг 3: Публичный комментарий
      await request(server)
        .post(`/api/v1/suggestions/${suggestionId}/comments`)
        .set(headers(ADMIN))
        .send({
          body: 'Спасибо за идею, скоро реализуем!',
          isInternal: false,
        })
        .expect(201);

      const commentsAfterPublic = await request(server)
        .get(`/api/v1/suggestions/${suggestionId}/comments`)
        .set('X-Company-Id', companyId)
        .expect(200);

      expect(commentsAfterPublic.body.items.length).toBe(2);

      // Шаг 4: Бан нарушителя
      const banRes = await request(server)
        .post('/api/v1/bans')
        .set('X-Company-Id', companyId)
        .set('Content-Type', 'application/json')
        .send({ userId: 'user_B_456' });
      expect([200, 201]).toContain(banRes.status);

      const bansRes = await request(server)
        .get('/api/v1/bans')
        .set('X-Company-Id', companyId)
        .expect(200);

      expect(bansRes.body.items.some((b: { userId: string }) => b.userId === 'user_B_456')).toBe(
        true,
      );

      // Шаг 5: Проверка действия бана — голосование заблокировано
      const voteBannedRes = await request(server)
        .post(`/api/v1/suggestions/${suggestionId}/vote`)
        .set(headers(USER_B))
        .send({ vote: 'upvote' });

      expect(voteBannedRes.status).toBe(403);
      expect(voteBannedRes.body.error?.code).toBe('USER_BANNED');

      // Шаг 6: Разбан
      await request(server)
        .delete('/api/v1/bans/user_B_456')
        .set('X-Company-Id', companyId)
        .expect(200);

      const voteAfterUnbanRes = await request(server)
        .post(`/api/v1/suggestions/${suggestionId}/vote`)
        .set(headers(USER_B))
        .send({ vote: 'upvote' });

      expect([200, 201]).toContain(voteAfterUnbanRes.status);
    });
  });

  describe('Scenario C: Bulk & AI Flow', () => {
    const USER_A = 'user_A_123';
    const ADMIN = 'admin_999';

    let sug1: string;
    let sug2: string;
    let sug3: string;

    const headers = (userId: string): Record<string, string> => ({
      'X-Company-Id': companyId,
      'X-User-Id': userId,
      'Content-Type': 'application/json',
    });

    beforeAll(async () => {
      const server = app.getHttpServer();

      await request(server)
        .get('/api/v1/suggestions/config')
        .set('X-Company-Id', companyId)
        .expect(200);

      const res1 = await request(server)
        .post('/api/v1/suggestions')
        .set(headers(USER_A))
        .send({
          title: 'Scenario C предложение 1',
          description: 'Описание sug1',
          category: 'Улучшения',
          images: [],
        })
        .expect(201);

      const res2 = await request(server)
        .post('/api/v1/suggestions')
        .set(headers(USER_A))
        .send({
          title: 'Scenario C предложение 2',
          description: 'Описание sug2',
          category: 'Улучшения',
          images: [],
        })
        .expect(201);

      const res3 = await request(server)
        .post('/api/v1/suggestions')
        .set(headers(USER_A))
        .send({
          title: 'Scenario C предложение 3',
          description: 'Описание sug3',
          category: 'Улучшения',
          images: [],
        })
        .expect(201);

      sug1 = res1.body.id;
      sug2 = res2.body.id;
      sug3 = res3.body.id;
      expect(sug1).toBeDefined();
      expect(sug2).toBeDefined();
      expect(sug3).toBeDefined();
    });

    it('полный сценарий: bulk status, similar, merge, graceful degradation', async () => {
      const server = app.getHttpServer();

      // Шаг 1: Массовое изменение статуса (Bulk Status)
      const bulkStatusRes = await request(server)
        .post('/api/v1/suggestions/bulk/status')
        .set(headers(ADMIN))
        .send({ ids: [sug1, sug2], status: 'PLANNED' });

      expect([200, 201]).toContain(bulkStatusRes.status);

      const listRes = await request(server)
        .get('/api/v1/suggestions')
        .set(headers(USER_A))
        .expect(200);

      const findSug = (id: string): { id: string; lifecycle?: { status?: string } } | undefined =>
        listRes.body.items.find((i: { id: string }) => i.id === id);
      expect(findSug(sug1)?.lifecycle?.status).toBe('Planned');
      expect(findSug(sug2)?.lifecycle?.status).toBe('Planned');
      expect(findSug(sug3)?.lifecycle?.status).toBe('New');

      // Шаг 2: Успешный запрос к AI (Поиск дубликатов)
      const aiMockPool = aiMockAgent.get('http://ai-mock');
      aiMockPool
        .intercept({ path: '/rag/search', method: 'POST' })
        .reply(200, JSON.stringify([sug1]), { headers: { 'content-type': 'application/json' } });

      const similarRes = await request(server)
        .post('/api/v1/suggestions/similar')
        .set(headers(USER_A))
        .send({ text: 'Текст похожий на sug1' });

      expect([200, 201]).toContain(similarRes.status);
      expect(Array.isArray(similarRes.body)).toBe(true);
      expect(similarRes.body.length).toBe(1);
      expect(similarRes.body[0].content?.title).toBeDefined();
      expect(typeof similarRes.body[0].metrics?.upvotes).toBe('number');
      expect(typeof similarRes.body[0].metrics?.downvotes).toBe('number');
      expect(similarRes.body[0].id).toBe(sug1);

      // Шаг 3: Слияние дубликатов (Bulk Merge)
      const mergeRes = await request(server)
        .post('/api/v1/suggestions/bulk/merge')
        .set(headers(ADMIN))
        .send({ sourceIds: [sug3], targetId: sug1 });

      expect([200, 201]).toContain(mergeRes.status);

      const sug3Res = await request(server)
        .get(`/api/v1/suggestions/${sug3}`)
        .set(headers(USER_A))
        .expect(200);

      expect(sug3Res.body.lifecycle?.status).toBe('Duplicate');
      expect(sug3Res.body.lifecycle?.merged_into).toBe(sug1);

      // Шаг 4: Падение AI-сервиса (Graceful Degradation)
      aiMockAgent
        .get('http://ai-mock')
        .intercept({ path: '/rag/search', method: 'POST' })
        .reply(500);

      const similarDegradedRes = await request(server)
        .post('/api/v1/suggestions/similar')
        .set(headers(USER_A))
        .send({ text: 'Текст похожий на sug1' });

      expect([200, 201]).toContain(similarDegradedRes.status);
      expect(similarDegradedRes.status).not.toBe(500);
      expect(Array.isArray(similarDegradedRes.body)).toBe(true);
      expect(similarDegradedRes.body).toEqual([]);
    });
  });
});
