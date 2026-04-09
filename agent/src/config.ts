import * as dotenv from 'dotenv';
import * as path from 'path';

// Prefer the documented API env file, but still allow a root-level .env override.
dotenv.config({ path: path.resolve(__dirname, '../../agent-api/.env') });
dotenv.config();
