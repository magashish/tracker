export interface AuditLog {
  id?: number;
  actorAdminId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  createdAt?: Date;
}
