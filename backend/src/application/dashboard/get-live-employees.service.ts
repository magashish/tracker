import { SessionRepository } from '../ports/session-repository.port';
import { ConfigurationRepository } from '../ports/configuration-repository.port';

export interface LiveEmployee {
  employeeId: string;
  employeeFullName: string;
  deviceId: string;
  hostname: string;
  status: 'online' | 'offline';
  lastHeartbeatAt: Date;
}

export class GetLiveEmployeesService {
  constructor(
    private readonly sessions: SessionRepository,
    private readonly configuration: ConfigurationRepository
  ) {}

  async execute(): Promise<LiveEmployee[]> {
    const defaultHeartbeatSeconds = 30;
    const staleAfterSeconds = defaultHeartbeatSeconds * 3;
    const rows = await this.sessions.listLiveSessions(staleAfterSeconds);

    const now = Date.now();
    return rows.map((row) => {
      const staleMs = staleAfterSeconds * 1000;
      const isOnline = now - row.session.lastHeartbeatAt.getTime() <= staleMs;
      return {
        employeeId: row.employeeId,
        employeeFullName: row.employeeFullName,
        deviceId: row.deviceId,
        hostname: row.hostname,
        status: isOnline ? 'online' : 'offline',
        lastHeartbeatAt: row.session.lastHeartbeatAt,
      };
    });
  }
}
