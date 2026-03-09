/**
 * Сценарий 2: Интерактивное голосование и синхронизация
 * REST API для голосования; проверка обновления Embed (если бот обновляет при vote).
 * Примечание: кнопки в Discord обновляются при клике пользователя; REST vote не триггерит
 * обновление сообщения в текущей архитектуре. Проверяем корректность REST и наличие кнопок.
 */
import {
  apiFetch,
  createDiscordClient,
  ensureCordeConfig,
  findMessageByEmbedTitle,
  getChannelMessages,
  resolveChannelId,
} from './helpers';

const TEST_USER = 'corde-vote-user';
const POLL_DELAY_MS = 3000;
const MAX_POLL_ATTEMPTS = 10;

async function waitForEmbed(
  client: Awaited<ReturnType<typeof createDiscordClient>>,
  channelId: string,
  title: string,
): Promise<{ embeds?: { title?: string }[] } | undefined> {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, POLL_DELAY_MS));
    const messages = await getChannelMessages(client, channelId);
    const msg = findMessageByEmbedTitle(messages, title);
    if (msg) return msg;
  }
  return undefined;
}

describe('Corde: Scenario 2 — Voting', () => {
  let client: Awaited<ReturnType<typeof createDiscordClient>>;
  let channelId: string;
  let suggestionId: string;

  beforeAll(async () => {
    client = await createDiscordClient();
    channelId = await resolveChannelId(client);
    await ensureCordeConfig(channelId);
  }, 20000);

  afterAll(async () => {
    client.destroy();
  });

  it('2.0 подготовка: создание и публикация предложения', async () => {
    const createRes = await apiFetch('/api/v1/suggestions', {
      method: 'POST',
      body: {
        title: 'Corde: Идея для голосования',
        description: 'Проверка голосования',
        category: 'Общее',
      },
      userId: TEST_USER,
    });
    expect(createRes.status).toBe(201);
    const body = (await createRes.json()) as { id: string };
    suggestionId = body.id;

    const statusRes = await apiFetch(`/api/v1/suggestions/${suggestionId}/status`, {
      method: 'PATCH',
      body: { status: 'OPEN' },
      userId: TEST_USER,
    });
    expect(statusRes.status).toBe(200);

    const msg = await waitForEmbed(client, channelId, 'Corde: Идея для голосования');
    expect(msg).toBeDefined();
  });

  it('2.1 upvote — REST возвращает upvotes: 1', async () => {
    const res = await apiFetch(`/api/v1/suggestions/${suggestionId}/vote`, {
      method: 'POST',
      body: { vote: 'upvote' },
      userId: TEST_USER,
    });
    expect([200, 201]).toContain(res.status);
    const body = (await res.json()) as { upvotes?: number; downvotes?: number };
    expect(body.upvotes).toBe(1);
    expect(body.downvotes).toBe(0);
  });

  it('2.2 toggle — повторный upvote снимает голос', async () => {
    const res = await apiFetch(`/api/v1/suggestions/${suggestionId}/vote`, {
      method: 'POST',
      body: { vote: 'upvote' },
      userId: TEST_USER,
    });
    expect([200, 201]).toContain(res.status);
    const body = (await res.json()) as { upvotes?: number; downvotes?: number };
    expect(body.upvotes).toBe(0);
    expect(body.downvotes).toBe(0);
  });

  it('2.3 change mind — downvote', async () => {
    const res = await apiFetch(`/api/v1/suggestions/${suggestionId}/vote`, {
      method: 'POST',
      body: { vote: 'downvote' },
      userId: TEST_USER,
    });
    expect([200, 201]).toContain(res.status);
    const body = (await res.json()) as { upvotes?: number; downvotes?: number };
    expect(body.upvotes).toBe(0);
    expect(body.downvotes).toBe(1);
  });
});
