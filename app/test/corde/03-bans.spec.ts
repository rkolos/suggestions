/**
 * Сценарий 3: Безопасность и модерация (Negative Cases)
 * Проверка ограничений для забаненных пользователей.
 */
import { apiFetch, createDiscordClient } from './helpers';

describe('Corde: Scenario 3 — Bans', () => {
  let client: Awaited<ReturnType<typeof createDiscordClient>>;
  let suggestionId: string;
  let bannedUserId: string;

  beforeAll(async () => {
    client = await createDiscordClient();
    bannedUserId = client.user?.id ?? '';
    expect(bannedUserId).toBeTruthy();
  }, 20000);

  afterAll(async () => {
    client.destroy();
  });

  it('3.0 подготовка: создание предложения для теста бана', async () => {
    const createRes = await apiFetch('/api/v1/suggestions', {
      method: 'POST',
      body: {
        title: 'Corde: Идея для теста бана',
        description: 'Проверка бана',
        category: 'Общее',
      },
      userId: bannedUserId,
    });
    expect(createRes.status).toBe(201);
    const body = (await createRes.json()) as { id: string };
    suggestionId = body.id;

    await apiFetch(`/api/v1/suggestions/${suggestionId}/status`, {
      method: 'PATCH',
      body: { status: 'OPEN' },
      userId: bannedUserId,
    });
  });

  it('3.1 бан бота-тестера через REST', async () => {
    const res = await apiFetch('/api/v1/bans', {
      method: 'POST',
      body: { userId: bannedUserId },
    });
    expect([200, 201]).toContain(res.status);
  });

  it('3.2 голосование под баном — 403 USER_BANNED', async () => {
    const res = await apiFetch(`/api/v1/suggestions/${suggestionId}/vote`, {
      method: 'POST',
      body: { vote: 'upvote' },
      userId: bannedUserId,
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { error?: { code?: string } };
    expect(body.error?.code).toBe('USER_BANNED');
  });

  it('3.3 создание предложения под баном — 403', async () => {
    const res = await apiFetch('/api/v1/suggestions', {
      method: 'POST',
      body: {
        title: 'Под баном',
        description: 'Не должно пройти',
        category: 'Общее',
      },
      userId: bannedUserId,
    });
    expect(res.status).toBe(403);
  });

  it('3.4 разбан — доступ восстановлен', async () => {
    const deleteRes = await apiFetch(`/api/v1/bans/${bannedUserId}`, {
      method: 'DELETE',
    });
    expect(deleteRes.status).toBe(200);

    const voteRes = await apiFetch(`/api/v1/suggestions/${suggestionId}/vote`, {
      method: 'POST',
      body: { vote: 'upvote' },
      userId: bannedUserId,
    });
    expect([200, 201]).toContain(voteRes.status);
  });
});
