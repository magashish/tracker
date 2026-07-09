import { ActivityRepository } from '../ports/activity-repository.port';
import { ActivitySample } from '../../domain/entities/activity';
import { DomainError } from '../../domain/errors/domain-error';

export interface ActivityBatchInput {
  employeeId: string;
  deviceId: string;
  samples: Array<{
    sessionId: string;
    windowStart: Date;
    windowEnd: Date;
    appName: string;
    windowTitle: string | null;
    activeSeconds: number;
    idleSeconds: number;
  }>;
}

const MAX_BATCH_SIZE = 500;

export class RecordActivityBatchService {
  constructor(private readonly activity: ActivityRepository) {}

  async execute(input: ActivityBatchInput): Promise<{ accepted: number }> {
    if (input.samples.length === 0) {
      return { accepted: 0 };
    }
    if (input.samples.length > MAX_BATCH_SIZE) {
      throw DomainError.validation(`Batch too large: max ${MAX_BATCH_SIZE} samples per request`);
    }

    const rows: ActivitySample[] = input.samples.map((s) => ({
      sessionId: s.sessionId,
      employeeId: input.employeeId,
      deviceId: input.deviceId,
      windowStart: s.windowStart,
      windowEnd: s.windowEnd,
      appName: s.appName,
      windowTitle: s.windowTitle,
      activeSeconds: s.activeSeconds,
      idleSeconds: s.idleSeconds,
    }));

    const accepted = await this.activity.insertBatch(rows);
    return { accepted };
  }
}
