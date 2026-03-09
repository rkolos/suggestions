import { ShardingManager } from 'discord.js';
import { join } from 'path';

const token = process.env.DISCORD_BOT_TOKEN;
if (!token?.trim()) {
  console.error('[ShardingManager] DISCORD_BOT_TOKEN is required');
  process.exit(1);
}

const manager = new ShardingManager(join(__dirname, 'main.js'), {
  token,
  totalShards: 'auto',
});

manager.on('shardCreate', (shard) => {
  console.log(`Launched shard ${shard.id}`);
});

manager.spawn();
