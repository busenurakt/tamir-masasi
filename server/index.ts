import { createApp } from './app.js';
import { openStore } from './store.js';
try {process.loadEnvFile('.env');} catch (error) {if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;}
const store = await openStore(process.env.DATABASE_URL, process.env.SEED_DEMO !== 'false');
const app = createApp(store, {static: process.argv.includes('--static'), origin: process.env.APP_ORIGIN});
app.addHook('onClose', async () => store.close());
try {
  await app.listen({host: '127.0.0.1', port: Number(process.env.PORT || 3025)});
  console.log(`Tamir Masası: http://127.0.0.1:${process.env.PORT || 3025}`);
} catch (error) {await app.close(); throw error;}
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => {void app.close();});
