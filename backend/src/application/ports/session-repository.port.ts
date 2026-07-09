import { Session, SessionEndReason } from '../../domain/entities/session';

export interface SessionRepository {
  start(employeeId: string, deviceId: string): Promise<Session>;
  findById(id: string): Promise<Session | null>;
  recordHeartbeat(sessionId: string): Promise<void>;
  end(sessionId: string, reason: SessionEndReason): Promise<void>;
  findOpenByDevice(deviceId: string): Promise<Session | null>;
  listLiveSessions(staleAfterSeconds: number): Promise<
    Array<{
      session: Session;
      employeeId: string;
      employeeFullName: string;
      deviceId: string;
      hostname: string;
    }>
  >;
}
