#!/usr/bin/env node
/**
 * Wrapper for Corde tests.
 * If CORDE_BOT_TOKEN is not set, skip (exit 0) instead of failing.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.test') });

if (!process.env.CORDE_BOT_TOKEN?.trim()) {
  console.log('Skipping Corde tests: CORDE_BOT_TOKEN not set');
  process.exit(0);
}

require('child_process').spawn(
  require('path').resolve(__dirname, '../node_modules/.bin/jest'),
  ['--config', 'test/jest-corde.json', '--runInBand'],
  { stdio: 'inherit', cwd: require('path').resolve(__dirname, '..') },
).on('exit', (code) => process.exit(code ?? 0));
