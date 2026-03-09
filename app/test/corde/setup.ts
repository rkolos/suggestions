/**
 * Corde test setup. Loads .env.test before tests.
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

const appRoot = path.resolve(__dirname, '../..');
const envPath = path.join(appRoot, '.env.test');
dotenv.config({ path: envPath, override: true });
dotenv.config({ path: path.join(appRoot, '.env'), override: false });
process.env.NODE_ENV = 'test';
