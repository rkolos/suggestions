/**
 * Запускает suggestions.e2e-spec первым (teardown), затем app.e2e-spec.
 */
const Sequencer = require('@jest/test-sequencer').default;

class CustomSequencer extends Sequencer {
  sort(tests) {
    const copy = [...tests];
    return copy.sort((a, b) => {
      const aFirst = a.path.includes('suggestions.e2e-spec');
      const bFirst = b.path.includes('suggestions.e2e-spec');
      if (aFirst && !bFirst) return -1;
      if (!aFirst && bFirst) return 1;
      return 0;
    });
  }
}

module.exports = CustomSequencer;
