import { Admin, Role } from '../../domain/entities/admin';

export type NewAdmin = Omit<Admin, 'id' | 'createdAt' | 'updatedAt' | 'lastLoginAt' | 'roleName' | 'permissions'>;

export interface AdminRepository {
  findById(id: string): Promise<Admin | null>;
  findByEmail(email: string): Promise<Admin | null>;
  create(admin: NewAdmin): Promise<Admin>;
  update(id: string, patch: Partial<NewAdmin>): Promise<Admin>;
  touchLastLogin(id: string): Promise<void>;
  list(): Promise<Admin[]>;
  listRoles(): Promise<Role[]>;
  findRoleByName(name: string): Promise<Role | null>;
}
