export type SessionEndReason = 'logout' | 'idle_timeout' | 'device_offline' | 'app_closed';

export interface Session {
  id: string;
  employeeId: string;
  deviceId: string;
  startedAt: Date;
  endedAt: Date | null;
  endReason: SessionEndReason | null;
  lastHeartbeatAt: Date;
}
