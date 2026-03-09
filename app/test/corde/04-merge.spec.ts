/**
 * Сценарий 4: Слияние и дубликаты (Merge Flow)
 */
import {
  apiFetch,
  createDiscordClient,
  ensureCordeConfig,
  findMessageByEmbedTitle,
  getChannelMessages,
  resolveChannelId,
  STATUS_COLORS,
} from './helpers';

const TEST_USER = 'corde-merge-user';
const POLL_DELAY_MS = 3000;
const MAX_POLL_ATTEMPTS = 10;

async function waitForEmbed(
  client: Awaited<ReturnType<typeof createDiscordClient>>,
  channelId: string,
  title: string,
  expectedColor?: number,
): Promise<{ embeds?: { title?: string; color?: number }[] } | undefined> {
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
  return undefined;
}

describe('Corde: Scenario 4 — Merge', () => {
  let client: Awaited<ReturnType<typeof createDiscordClient>>;
  let channelId: string;
  let ideaAId: string;
  let ideaBId: string;

  beforeAll(async () => {
    client = await createDiscordClient();
    channelId = await resolveChannelId(client);
    await ensureCordeConfig(channelId);
  }, 20000);

  afterAll(async () => {
    client.destroy();
  });

  it('4.1 подготовка: создание Идеи А и Идеи Б, перевод в OPEN', async () => {
    const createARes = await apiFetch('/api/v1/suggestions', {
      method: 'POST',
      body: {
        title: 'Corde: Идея А (target)',
        description: 'Целевая идея для слияния',
        category: 'Общее',
      },
      userId: TEST_USER,
    });
    expect(createARes.status).toBe(201);
    ideaAId = ((await createARes.json()) as { id: string }).id;

    const createBRes = await apiFetch('/api/v1/suggestions', {
      method: 'POST',
      body: {
        title: 'Corde: Идея Б (source)',
        description: 'Идея-дубликат для слияния',
        category: 'Общее',
      },
      userId: TEST_USER,
    });
    expect(createBRes.status).toBe(201);
    ideaBId = ((await createBRes.json()) as { id: string }).id;

    await apiFetch(`/api/v1/suggestions/${ideaAId}/status`, {
      method: 'PATCH',
      body: { status: 'OPEN' },
      userId: TEST_USER,
    });
    await apiFetch(`/api/v1/suggestions/${ideaBId}/status`, {
      method: 'PATCH',
      body: { status: 'OPEN' },
      userId: TEST_USER,
    });

    const msgA = await waitForEmbed(client, channelId, 'Corde: Идея А (target)');
    const msgB = await waitForEmbed(client, channelId, 'Corde: Идея Б (source)');
    expect(msgA).toBeDefined();
    expect(msgB).toBeDefined();
  });

  it('4.2 слияние Б в А — Embed Б: DUPLICATE, ссылка на А', async () => {
    const res = await apiFetch('/api/v1/suggestions/merge', {
      method: 'POST',
      body: { sourceId: ideaBId, targetId: ideaAId },
      userId: TEST_USER,
    });
    expect([200, 201]).toContain(res.status);

    const msg = await waitForEmbed(
      client,
      channelId,
      'Corde: Идея Б (source)',
      STATUS_COLORS.DUPLICATE,
    );
    expect(msg).toBeDefined();
    expect(msg?.embeds?.[0]?.color).toBe(STATUS_COLORS.DUPLICATE);
  });
});
