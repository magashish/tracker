import { promises as fs } from 'node:fs';
import closeWithGrace from 'close-with-grace';
import { buildContainer } from './container';
import { buildApp } from './app';
import { env } from './config/env';

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

async function main() {
  const container = buildContainer();
  await fs.mkdir(env.SCREENSHOT_STORAGE_DIR, { recursive: true });

  const app = await buildApp(container);

  const runCleanup = async () => {
    try {
      const { deleted } = await container.screenshots.cleanupOldScreenshots.execute();
      if (deleted > 0) {
        container.logger.info({ deleted }, 'Deleted screenshots past retention period');
      }
    } catch (err) {
      container.logger.error({ err }, 'Screenshot retention cleanup failed');
    }
  };

  await runCleanup();
  const cleanupTimer = setInterval(runCleanup, CLEANUP_INTERVAL_MS);
  cleanupTimer.unref();

  await app.listen({ host: env.HOST, port: env.PORT });

  closeWithGrace({ delay: 5000 }, async ({ err }) => {
    if (err) {
      container.logger.error({ err }, 'Shutting down due to error');
    }
    clearInterval(cleanupTimer);
    await app.close();
    await container.pool.end();
    container.redis.disconnect();
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal error during startup:', err);
  process.exit(1);
});
