import { DomainError } from '../../domain/errors/domain-error';
import { SessionRepository } from '../ports/session-repository.port';
import { DeviceRepository } from '../ports/device-repository.port';
import { Session, SessionEndReason } from '../../domain/entities/session';

export class SessionLifecycleService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly devices: DeviceRepository
  ) {}

  async start(employeeId: string, deviceId: string): Promise<Session> {
    const device = await this.devices.findById(deviceId);
    if (!device || device.employeeId !== employeeId) {
      throw DomainError.notFound('Device not found');
    }
    if (device.status === 'revoked') {
      throw DomainError.forbidden('Device has been revoked');
    }

    const existingOpen = await this.sessions.findOpenByDevice(deviceId);
    if (existingOpen) {
      return existingOpen;
    }

    return this.sessions.start(employeeId, deviceId);
  }

  async end(sessionId: string, employeeId: string, reason: SessionEndReason): Promise<void> {
    const session = await this.sessions.findById(sessionId);
    if (!session || session.employeeId !== employeeId) {
      throw DomainError.notFound('Session not found');
    }
    if (session.endedAt) {
      return;
    }
    await this.sessions.end(sessionId, reason);
  }
}
