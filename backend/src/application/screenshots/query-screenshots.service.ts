import { DomainError } from '../../domain/errors/domain-error';
import { ScreenshotRepository } from '../ports/screenshot-repository.port';
import { ScreenshotStorage } from '../ports/screenshot-storage.port';
import { AuditLogRepository } from '../ports/audit-log-repository.port';

const VIEW_URL_TTL_SECONDS = 60;

export class QueryScreenshotsService {
  constructor(
    private readonly screenshots: ScreenshotRepository,
    private readonly storage: ScreenshotStorage,
    private readonly auditLogs: AuditLogRepository
  ) {}

  async list(params: { employeeId?: string; from?: Date; to?: Date; page: number; pageSize: number }) {
    const { items, total } = await this.screenshots.query(params);
    const withUrls = await Promise.all(
      items.map(async (s) => ({
        ...s,
        viewUrl: await this.storage.createViewUrl(s.storageKey, VIEW_URL_TTL_SECONDS),
      }))
    );
    return { items: withUrls, total };
  }

  async getOne(screenshotId: string, actorAdminId: string, ipAddress: string | null) {
    const screenshot = await this.screenshots.findById(screenshotId);
    if (!screenshot) {
      throw DomainError.notFound('Screenshot not found');
    }
    const viewUrl = await this.storage.createViewUrl(screenshot.storageKey, VIEW_URL_TTL_SECONDS);

    await this.auditLogs.record({
      actorAdminId,
      action: 'employee.screenshot.view',
      entityType: 'screenshot',
      entityId: screenshot.id,
      metadata: { employeeId: screenshot.employeeId },
      ipAddress,
    });

    return { ...screenshot, viewUrl, expiresIn: VIEW_URL_TTL_SECONDS };
  }

  async blur(screenshotId: string, blurred: boolean): Promise<void> {
    const screenshot = await this.screenshots.findById(screenshotId);
    if (!screenshot) {
      throw DomainError.notFound('Screenshot not found');
    }
    await this.screenshots.setBlurred(screenshotId, blurred);
  }
}
