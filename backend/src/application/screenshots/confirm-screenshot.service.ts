import { DomainError } from '../../domain/errors/domain-error';
import { ScreenshotRepository } from '../ports/screenshot-repository.port';

export class ConfirmScreenshotService {
  constructor(private readonly screenshots: ScreenshotRepository) {}

  async execute(screenshotId: string, employeeId: string): Promise<void> {
    const screenshot = await this.screenshots.findById(screenshotId);
    if (!screenshot || screenshot.employeeId !== employeeId) {
      throw DomainError.notFound('Screenshot not found');
    }
    await this.screenshots.confirmUploaded(screenshotId);
  }
}
