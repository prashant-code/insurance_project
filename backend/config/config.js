import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.resolve(__dirname, '../../config.json');
let configData = {};

try {
  const rawData = fs.readFileSync(configPath, 'utf-8');
  configData = JSON.parse(rawData);
} catch (e) {
  console.warn('config.json not found or invalid, falling back to defaults.');
  configData = {
    server: { port: 3000 },
    database: { engine: 'postgres', poolMax: 20 },
    redis: { url: 'redis://localhost:6379', rateLimit: { capacity: 100, refillRate: 10 } }
  };
}

export default configData;
