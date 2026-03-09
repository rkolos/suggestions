/**
 * Сценарий 1: Полный жизненный цикл и визуализация (Status Cycle)
 * Проверяет обновление Embed при смене статусов в БД.
 */
import {
  apiFetch,
  createDiscordClient,
  ensureCordeConfig,
  findMessageByEmbedTitle,
  getChannelMessages,
  isThreadLocked,
  resolveChannelId,
  STATUS_COLORS,
} from './helpers';

const TEST_USER = 'corde-test-user';
const POLL_DELAY_MS = 5000;
const MAX_POLL_ATTEMPTS = 15;
const BULLMQ_INITIAL_DELAY_MS = 8000;

async function waitForEmbed(
  client: Awaited<ReturnType<typeof createDiscordClient>>,
  channelId: string,
  title: string,
  expectedColor?: number,
): Promise<{ embeds?: { title?: string; color?: number }[] }> {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, POLL_DELAY_MS));
    const messages = await getChannelMessages(client, channelId);
    const msg = findMessageByEmbedTitle(messages, title);
    if (msg) {
      const color = msg.embeds?.[0]?.color;
      if (expectedColor === undefined || color === expectedColor) {
        return msg;
      }
    }
  }
  const lastMessages = await getChannelMessages(client, channelId);
  const titles = [...lastMessages.values()].map((m) => m.embeds?.[0]?.title).filter(Boolean);
  throw new Error(
    `Embed "${title}" not found after ${MAX_POLL_ATTEMPTS} attempts. Channel embeds: ${titles.join(', ') || 'none'}. Check: suggestionsChannelId in config, BullMQ/Redis, bot in guild.`,
  );
}

describe('Corde: Scenario 1 — Status Cycle', () => {
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

  it('1.1 создание предложения через REST', async () => {
    const res = await apiFetch('/api/v1/suggestions', {
      method: 'POST',
      body: {
        title: 'Corde: Идея для Status Cycle',
        description: 'Проверка жизненного цикла статусов',
        category: 'Общее',
      },
      userId: TEST_USER,
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string };
    suggestionId = body.id;
    expect(suggestionId).toBeDefined();
  });

  it('1.2 публикация в OPEN — Embed в канале, Thread создан', async () => {
    const res = await apiFetch(`/api/v1/suggestions/${suggestionId}/status`, {
      method: 'PATCH',
      body: { status: 'OPEN' },
      userId: TEST_USER,
    });
    expect(res.status).toBe(200);

    await new Promise((r) => setTimeout(r, BULLMQ_INITIAL_DELAY_MS));
    const msg = await waitForEmbed(
      client,
      channelId,
      'Corde: Идея для Status Cycle',
      STATUS_COLORS.OPEN,
    );
    expect(msg.embeds?.[0]?.color).toBe(STATUS_COLORS.OPEN);
  });

  it('1.3 смена на IN_PROGRESS — Embed обновился, не создан новый', async () => {
    const res = await apiFetch(`/api/v1/suggestions/${suggestionId}/status`, {
      method: 'PATCH',
      body: { status: 'IN_PROGRESS' },
      userId: TEST_USER,
    });
    expect(res.status).toBe(200);

    const msg = await waitForEmbed(
      client,
      channelId,
      'Corde: Идея для Status Cycle',
      STATUS_COLORS.IN_PROGRESS,
    );
    expect(msg.embeds?.[0]?.color).toBe(STATUS_COLORS.IN_PROGRESS);
  });

  it('1.4 завершение COMPLETED — Embed зелёный, Thread заблокирован', async () => {
    const res = await apiFetch(`/api/v1/suggestions/${suggestionId}/status`, {
      method: 'PATCH',
      body: { status: 'COMPLETED' },
      userId: TEST_USER,
    });
    expect(res.status).toBe(200);

    const msg = await waitForEmbed(
      client,
      channelId,
      'Corde: Идея для Status Cycle',
      STATUS_COLORS.COMPLETED,
    );
    expect(msg.embeds?.[0]?.color).toBe(STATUS_COLORS.COMPLETED);

    const messages = await getChannelMessages(client, channelId);
    const found = findMessageByEmbedTitle(messages, 'Corde: Идея для Status Cycle');
    expect(found).toBeDefined();
    if (found?.threadId) {
      const locked = await isThreadLocked(client, found.threadId);
      expect(locked).toBe(true);
    }
  });
});
