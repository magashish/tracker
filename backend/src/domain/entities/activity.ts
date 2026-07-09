export interface ActivitySample {
  id?: number;
  sessionId: string;
  employeeId: string;
  deviceId: string;
  windowStart: Date;
  windowEnd: Date;
  appName: string;
  windowTitle: string | null;
  activeSeconds: number;
  idleSeconds: number;
}
