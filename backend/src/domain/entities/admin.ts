export type AdminStatus = 'active' | 'disabled';

export interface Role {
  id: string;
  name: string;
  permissions: Record<string, boolean>;
}

export interface Admin {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  roleId: string;
  roleName?: string;
  permissions?: Record<string, boolean>;
  status: AdminStatus;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
