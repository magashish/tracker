import { ActivityRepository } from '../ports/activity-repository.port';
import { ScreenshotRepository } from '../ports/screenshot-repository.port';
import { ScreenshotStorage } from '../ports/screenshot-storage.port';

export interface EmployeeDaySummary {
  employeeId: string;
  date: string;
  activeSeconds: number;
  idleSeconds: number;
  screenshotCount: number;
  latestScreenshotUrl: string | null;
}

export class GetEmployeeReportService {
  constructor(
    private readonly activity: ActivityRepository,
    private readonly screenshots: ScreenshotRepository,
    private readonly storage: ScreenshotStorage
  ) {}

  async daySummary(employeeId: string, date: Date): Promise<EmployeeDaySummary> {
    const from = new Date(date);
    from.setUTCHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 1);

    let activeSeconds = 0;
    let idleSeconds = 0;
    let cursor: string | undefined;
    // Paginate through the day's activity rows to compute totals without loading
    // an unbounded result set into memory.
    for (;;) {
      const page = await this.activity.query({ employeeId, from, to, cursor, limit: 500 });
      for (const sample of page.items) {
        activeSeconds += sample.activeSeconds;
        idleSeconds += sample.idleSeconds;
      }
      if (!page.nextCursor) break;
      cursor = page.nextCursor;
    }

    const { items: shots, total } = await this.screenshots.query({
      employeeId,
      from,
      to,
      page: 1,
      pageSize: 1,
    });

    const latest = shots[0];
    const latestScreenshotUrl = latest ? await this.storage.createViewUrl(latest.storageKey, 60) : null;

    return {
      employeeId,
      date: from.toISOString().slice(0, 10),
      activeSeconds,
      idleSeconds,
      screenshotCount: total,
      latestScreenshotUrl,
    };
  }

  async timeline(employeeId: string, date: Date) {
    const from = new Date(date);
    from.setUTCHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 1);

    const activity = await this.activity.query({ employeeId, from, to, limit: 500 });
    const { items: screenshots } = await this.screenshots.query({ employeeId, from, to, page: 1, pageSize: 200 });

    return { activity: activity.items, screenshots };
  }
}
