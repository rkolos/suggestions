/**
 * Corde config with env interpolation.
 * Load .env.test via: DOTENV_CONFIG_PATH=./.env.test node -r dotenv/config node_modules/.bin/corde
 */
module.exports = {
  cordeBotToken: process.env.CORDE_BOT_TOKEN || '',
  botTestId: process.env.DISCORD_CLIENT_ID || '',
  guildId: process.env.CORDE_GUILD_ID || '',
  channelId: process.env.CORDE_CHANNEL_ID || '',
  botPrefix: '!',
  testMatches: ['./test/corde/**/*.spec.ts'],
};
