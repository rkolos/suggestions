/**
 * Helpers for Corde Discord E2E tests.
 * REST API client and Discord bot utilities.
 */
import { Client, GatewayIntentBits } from 'discord.js';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
const COMPANY_ID = process.env.CORDE_COMPANY_ID || '00000000-0000-0000-0000-000000000002';

export function getHeaders(userId?: string): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Company-Id': COMPANY_ID,
  };
  if (userId) {
    h['X-User-Id'] = userId;
  }
  return h;
}

export async function apiFetch(
  path: string,
  options: { method?: string; body?: object; userId?: string } = {},
): Promise<Response> {
  const { method = 'GET', body, userId } = options;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: getHeaders(userId),
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

export async function createDiscordClient(): Promise<Client> {
  const token = process.env.CORDE_BOT_TOKEN;
  if (!token) {
    throw new Error('CORDE_BOT_TOKEN required');
  }
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });
  await client.login(token);
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Discord login timeout')), 15000);
    if (client.isReady()) {
      clearTimeout(timeout);
      resolve();
      return;
    }
    client.once('ready', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
  return client;
}

export interface CordeMessage {
  embeds?: { title?: string; color?: number }[];
  threadId?: string;
}

/** Ensures CompanyConfig has suggestionsChannelId for Corde company — required for Discord publish */
export async function ensureCordeConfig(channelId: string): Promise<void> {
  const res = await apiFetch('/api/v1/suggestions/config', {
    method: 'PUT',
    body: { suggestionsChannelId: channelId },
  });
  if (!res.ok) {
    throw new Error(`Failed to update config: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { suggestionsChannelId?: string | null };
  if (body.suggestionsChannelId !== channelId) {
    throw new Error(
      `Config channel mismatch: expected ${channelId}, got ${body.suggestionsChannelId}`,
    );
  }
}

/** Resolves channel ID — if CORDE_CHANNEL_ID fails (e.g. guild ID was used), fetches first text channel from guild */
export async function resolveChannelId(client: Client): Promise<string> {
  const channelId = process.env.CORDE_CHANNEL_ID?.trim();
  const guildId = process.env.CORDE_GUILD_ID?.trim();
  if (channelId) {
    try {
      const ch = await client.channels.fetch(channelId);
      if (ch && 'messages' in ch) return channelId;
    } catch {
      // channelId might be guild ID or invalid — fallback to guild channels
    }
  }
  if (!guildId) throw new Error('CORDE_CHANNEL_ID or CORDE_GUILD_ID required');
  const guild = await client.guilds.fetch(guildId);
  const ch = guild.channels.cache.find((c) => c.isTextBased() && !c.isThread());
  if (!ch) throw new Error(`No text channel found in guild ${guildId}`);
  return ch.id;
}

export async function getChannelMessages(
  client: Client,
  channelId: string,
  limit = 50,
): Promise<Map<string, CordeMessage>> {
  const channel = await client.channels.fetch(channelId);
  if (!channel || !('messages' in channel)) {
    throw new Error(`Channel ${channelId} not found or not text-based`);
  }
  const coll = await channel.messages.fetch({ limit });
  const result = new Map<string, CordeMessage>();
  for (const [id, msg] of coll) {
    result.set(id, {
      embeds: msg.embeds.map((e) => ({ title: e.title ?? undefined, color: e.color ?? undefined })),
      threadId: msg.thread?.id,
    });
  }
  return result;
}

export async function isThreadLocked(client: Client, threadId: string): Promise<boolean> {
  const thread = await client.channels.fetch(threadId);
  return thread?.isThread?.() ? (thread.locked ?? false) : false;
}

export function findMessageByEmbedTitle(
  messages: Map<string, CordeMessage>,
  title: string,
): CordeMessage | undefined {
  for (const msg of messages.values()) {
    const embed = msg.embeds?.[0];
    if (embed?.title === title) {
      return msg;
    }
  }
  return undefined;
}

export const STATUS_COLORS = {
  OPEN: 0xfee75c,
  IN_PROGRESS: 0x5865f2,
  COMPLETED: 0x57f287,
  DUPLICATE: 0x747f8d,
} as const;
