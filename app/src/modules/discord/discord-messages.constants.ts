/**
 * Shared user-facing messages for Discord bot (English only).
 * Use the same wording for the same situations across guards and handlers.
 */
export const DISCORD_MESSAGES = {
  /** When command is invoked in DMs instead of a server */
  DM_ONLY_SERVERS: 'This bot works on Discord servers only. Please run the command in a server.',

  /** When the server is not linked to a company in the dashboard */
  SERVER_NOT_SET_UP:
    'This server is not set up yet. Please ask an administrator to link this server in the dashboard.',
} as const;
