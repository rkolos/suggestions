/**
 * Сценарий 5: Публичные ответы (Admin Responses)
 */
import { apiFetch, createDiscordClient, ensureCordeConfig, resolveChannelId } from './helpers';

const TEST_USER = 'corde-admin-user';
const POLL_DELAY_MS = 6000;
const MAX_POLL_ATTEMPTS = 25;
const BULLMQ_INITIAL_DELAY_MS = 25000;

describe('Corde: Scenario 5 — Admin Comments', () => {
  let client: Awaited<ReturnType<typeof createDiscordClient>>;
  let channelId: string;
  let suggestionId: string;
  let threadId: string;
  const commentText = 'Corde: Официальный ответ админа для теста';

  beforeAll(async () => {
    client = await createDiscordClient();
    channelId = await resolveChannelId(client);
    await ensureCordeConfig(channelId);
  }, 20000);

  afterAll(async () => {
    client.destroy();
  });

  it('5.0 подготовка: создание предложения и публикация', async () => {
    const createRes = await apiFetch('/api/v1/suggestions', {
      method: 'POST',
      body: {
        title: 'Corde: Идея для комментария',
        description: 'Проверка публичного ответа',
        category: 'Общее',
      },
      userId: TEST_USER,
    });
    expect(createRes.status).toBe(201);
    suggestionId = ((await createRes.json()) as { id: string }).id;

    await apiFetch(`/api/v1/suggestions/${suggestionId}/status`, {
      method: 'PATCH',
      body: { status: 'OPEN' },
      userId: TEST_USER,
    });

    await new Promise((r) => setTimeout(r, BULLMQ_INITIAL_DELAY_MS));
    const channel = await client.channels.fetch(channelId);
    if (!channel || !('messages' in channel)) {
      throw new Error('Channel not found');
    }
    const messages = await channel.messages.fetch({ limit: 20 });
    const msg = messages.find((m) => m.embeds[0]?.title === 'Corde: Идея для комментария');
    if (!msg) {
      const titles = [...messages.values()].map((m) => m.embeds[0]?.title).filter(Boolean);
      throw new Error(
        `Embed "Corde: Идея для комментария" not found in channel. Found: ${titles.join(', ') || 'none'}. Check: suggestionsChannelId in config, BullMQ running, bot in guild.`,
      );
    }
    threadId = msg.thread?.id ?? '';
    if (!threadId) {
      throw new Error('Thread not created for suggestion - check Discord publish');
    }
  });

  it('5.1 добавление публичного комментария через REST', async () => {
    const res = await apiFetch(`/api/v1/suggestions/${suggestionId}/comments`, {
      method: 'POST',
      body: { body: commentText, isInternal: false },
      userId: TEST_USER,
    });
    expect(res.status).toBe(201);
  });

  it('5.2 проверка: в Thread появилось сообщение с [ОФИЦИАЛЬНЫЙ ОТВЕТ]', async () => {
    if (!threadId) {
      return; // skip: 5.0 failed
    }
    let found = false;
    for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
      await new Promise((r) => setTimeout(r, POLL_DELAY_MS));
      const thread = await client.channels.fetch(threadId);
      if (!thread || !thread.isThread()) continue;
      const messages = await thread.messages.fetch({ limit: 50 });
      const contents = [...messages.values()]
        .map((m) => m.content ?? '')
        .filter((c): c is string => typeof c === 'string' && c.length > 0);
      found = contents.some((c) => c.includes('[ОФИЦИАЛЬНЫЙ ОТВЕТ') && c.includes(commentText));
      if (found) break;
    }
    expect(found).toBe(true);
  }, 180000);
});
