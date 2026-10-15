import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';
import { connectDb } from './shared/db/client.js';
import { supabaseTokenVerifier } from './shared/auth/token.js';
import { expoPushSender } from './modules/notifications/index.js';
import { supabaseStorageSigner } from './modules/uploads/index.js';
import { startJobs } from './jobs/index.js';

const env = loadEnv();
const { db, close } = connectDb(env.DATABASE_URL);

const logger = env.NODE_ENV === 'development'
  ? { level: env.LOG_LEVEL, transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } }
  : { level: env.LOG_LEVEL };

const { app, bus, services } = await buildApp({
  db,
  logger,
  verify: supabaseTokenVerifier({ supabaseUrl: env.SUPABASE_URL, jwtSecret: env.SUPABASE_JWT_SECRET }),
  push: expoPushSender(console),
  storage: supabaseStorageSigner(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY),
  setupToken: env.SETUP_TOKEN,
  corsOrigins: env.CORS_ORIGINS,
});

const stopJobs = env.JOBS_ENABLED
  ? startJobs({ attendance: services.attendance, memberships: services.memberships, habits: services.habits, log: app.log })
  : () => {};

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  stopJobs();
  await app.close();
  await bus.drain();
  await close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

await app.listen({ port: env.PORT, host: env.HOST });
