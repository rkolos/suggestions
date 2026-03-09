import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

export function buildVoteButtons(
  suggestionId: string,
  upvotes: number,
  downvotes: number,
): ActionRowBuilder<ButtonBuilder>[] {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`vote_up_${suggestionId}`)
      .setLabel(`👍 ${upvotes}`)
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`vote_down_${suggestionId}`)
      .setLabel(`👎 ${downvotes}`)
      .setStyle(ButtonStyle.Secondary),
  );
  return [row];
}
