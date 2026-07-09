import { DomainError } from '../../domain/errors/domain-error';
import { SessionRepository } from '../ports/session-repository.port';
import { ActivityRepository } from '../ports/activity-repository.port';
import { ConfigurationRepository } from '../ports/configuration-repository.port';
import { EffectiveConfig } from '../../domain/entities/configuration';
import { Clock } from '../ports/token.port';

export interface HeartbeatInput {
  sessionId: string;
  employeeId: string;
  deviceId: string;
  capturedAt: Date;
  idleSeconds: number;
  systemUptimeSeconds: number;
  activeApp: string;
  activeWindowTitle: string | null;
}

export interface HeartbeatResult {
  acknowledged: true;
  config: EffectiveConfig;
}

const HEARTBEAT_WINDOW_SECONDS = 30;

export class RecordHeartbeatService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly activity: ActivityRepository,
    private readonly configuration: ConfigurationRepository,
    private readonly clock: Clock
  ) {}

  async execute(input: HeartbeatInput): Promise<HeartbeatResult> {
    const session = await this.sessions.findById(input.sessionId);
    if (!session || session.employeeId !== input.employeeId || session.deviceId !== input.deviceId) {
      throw DomainError.notFound('Session not found');
    }
    if (session.endedAt) {
      throw DomainError.conflict('Session has already ended');
    }

    await this.sessions.recordHeartbeat(session.id);

    const windowEnd = input.capturedAt;
    const windowStart = new Date(windowEnd.getTime() - HEARTBEAT_WINDOW_SECONDS * 1000);
    const activeSeconds = Math.max(0, HEARTBEAT_WINDOW_SECONDS - input.idleSeconds);

    await this.activity.insertOne({
      sessionId: session.id,
      employeeId: input.employeeId,
      deviceId: input.deviceId,
      windowStart,
      windowEnd,
      appName: input.activeApp,
      windowTitle: input.activeWindowTitle,
      activeSeconds,
      idleSeconds: Math.min(input.idleSeconds, HEARTBEAT_WINDOW_SECONDS),
    });

    const config = await this.configuration.getEffectiveConfig(input.employeeId, input.deviceId);

    return { acknowledged: true, config };
  }
}
