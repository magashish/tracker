import { ScreenshotRepository } from '../ports/screenshot-repository.port';
import { ScreenshotStorage } from '../ports/screenshot-storage.port';
import { Clock } from '../ports/token.port';

const BATCH_SIZE = 200;

export class CleanupOldScreenshotsService {
  constructor(
    private readonly screenshots: ScreenshotRepository,
    private readonly storage: ScreenshotStorage,
    private readonly clock: Clock,
    private readonly retentionDays: number
  ) {}

  async execute(): Promise<{ deleted: number }> {
    const cutoff = new Date(this.clock.now().getTime() - this.retentionDays * 24 * 60 * 60 * 1000);
    let deleted = 0;

    for (;;) {
      const batch = await this.screenshots.findOlderThan(cutoff, BATCH_SIZE);
      if (batch.length === 0) break;

      for (const screenshot of batch) {
        await this.storage.deleteObject(screenshot.storageKey);
        await this.screenshots.deleteById(screenshot.id);
        deleted += 1;
      }

      if (batch.length < BATCH_SIZE) break;
    }

    return { deleted };
  }
}
