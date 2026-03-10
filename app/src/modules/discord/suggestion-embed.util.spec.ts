import { SuggestionStatus } from '@prisma/client';
import { buildSuggestionEmbed } from './suggestion-embed.util';

describe('buildSuggestionEmbed', () => {
  const baseInput = {
    title: 'Test suggestion',
    description: 'Description',
    status: SuggestionStatus.DUPLICATE,
    mergedIntoId: 'sug-target-1',
  };

  it('adds Original field with plain ID when mergedIntoMessageUrl is not set', () => {
    const embed = buildSuggestionEmbed(baseInput);
    const field = embed.data.fields?.find((f) => f.name === 'Original');
    expect(field).toBeDefined();
    expect(field?.value).toBe('Merged into suggestion `sug-target-1`');
  });

  it('adds Original field with markdown link when mergedIntoMessageUrl is set', () => {
    const url = 'https://discord.com/channels/g1/c1/m1';
    const embed = buildSuggestionEmbed({
      ...baseInput,
      mergedIntoMessageUrl: url,
    });
    const field = embed.data.fields?.find((f) => f.name === 'Original');
    expect(field).toBeDefined();
    expect(field?.value).toBe(`Merged into [suggestion \`sug-target-1\`](${url})`);
  });

  it('does not add Original field when status is not DUPLICATE', () => {
    const embed = buildSuggestionEmbed({
      ...baseInput,
      status: SuggestionStatus.OPEN,
    });
    const field = embed.data.fields?.find((f) => f.name === 'Original');
    expect(field).toBeUndefined();
  });

  it('does not add Original field when mergedIntoId is missing', () => {
    const embed = buildSuggestionEmbed({ ...baseInput, mergedIntoId: undefined });
    const field = embed.data.fields?.find((f) => f.name === 'Original');
    expect(field).toBeUndefined();
  });
});
