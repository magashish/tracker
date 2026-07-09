export interface ApiEnvelope<T> {
  data: T;
  meta?: { page?: number; pageSize?: number; total?: number; nextCursor?: string | null };
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export type Role = 'owner' | 'admin' | 'manager' | 'viewer';

export interface AdminSession {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  admin: { id: string; fullName: string; email: string; role: Role };
}

export interface Employee {
  id: string;
  email: string;
  fullName: string;
  team: string | null;
  status: 'active' | 'suspended' | 'deactivated';
  monitoringConsentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Device {
  id: string;
  employeeId: string;
  deviceUuid: string;
  hostname: string;
  os: 'windows' | 'linux';
  osVersion: string | null;
  agentVersion: string;
  status: 'active' | 'revoked';
  lastSeenAt: string | null;
  registeredAt: string;
}

export interface LiveEmployee {
  employeeId: string;
  employeeFullName: string;
  deviceId: string;
  hostname: string;
  status: 'online' | 'offline';
  lastHeartbeatAt: string;
}

export interface EmployeeDaySummary {
  employeeId: string;
  date: string;
  activeSeconds: number;
  idleSeconds: number;
  screenshotCount: number;
  latestScreenshotUrl: string | null;
}

export interface ActivitySample {
  id: number;
  sessionId: string;
  employeeId: string;
  deviceId: string;
  windowStart: string;
  windowEnd: string;
  appName: string;
  windowTitle: string | null;
  activeSeconds: number;
  idleSeconds: number;
}

export interface Screenshot {
  id: string;
  sessionId: string;
  employeeId: string;
  deviceId: string;
  storageKey: string;
  capturedAt: string;
  uploadedAt: string | null;
  activityPercent: number | null;
  appName: string | null;
  windowTitle: string | null;
  isBlurred: boolean;
  viewUrl?: string;
}

export interface EmployeeTimeline {
  activity: ActivitySample[];
  screenshots: Screenshot[];
}

export interface Admin {
  id: string;
  email: string;
  fullName: string;
  roleId: string;
  roleName?: Role;
  status: 'active' | 'disabled';
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RoleDefinition {
  id: string;
  name: Role;
  permissions: Record<string, boolean>;
}

export interface EffectiveConfig {
  heartbeatIntervalSeconds: number;
  screenshotIntervalSeconds: number;
  screenshotQuality: number;
  idleThresholdSeconds: number;
  apiUrl: string;
}

export interface AuditLog {
  id: number;
  actorAdminId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: string;
}
