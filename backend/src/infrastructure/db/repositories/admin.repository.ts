import { Pool } from 'pg';
import { AdminRepository, NewAdmin } from '../../../application/ports/admin-repository.port';
import { Admin, Role } from '../../../domain/entities/admin';

interface AdminRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role_id: string;
  role_name: string;
  permissions: Record<string, boolean>;
  status: Admin['status'];
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function toAdmin(row: AdminRow): Admin {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    fullName: row.full_name,
    roleId: row.role_id,
    roleName: row.role_name,
    permissions: row.permissions,
    status: row.status,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_WITH_ROLE = `
  SELECT a.*, r.name AS role_name, r.permissions AS permissions
  FROM admins a JOIN roles r ON r.id = a.role_id
`;

export class PostgresAdminRepository implements AdminRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<Admin | null> {
    const { rows } = await this.pool.query<AdminRow>(`${SELECT_WITH_ROLE} WHERE a.id = $1`, [id]);
    return rows[0] ? toAdmin(rows[0]) : null;
  }

  async findByEmail(email: string): Promise<Admin | null> {
    const { rows } = await this.pool.query<AdminRow>(`${SELECT_WITH_ROLE} WHERE a.email = $1`, [email]);
    return rows[0] ? toAdmin(rows[0]) : null;
  }

  async create(admin: NewAdmin): Promise<Admin> {
    const { rows } = await this.pool.query<{ id: string }>(
      `INSERT INTO admins (email, password_hash, full_name, role_id, status) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [admin.email, admin.passwordHash, admin.fullName, admin.roleId, admin.status]
    );
    const created = await this.findById(rows[0]!.id);
    if (!created) throw new Error('Failed to load newly created admin');
    return created;
  }

  async update(id: string, patch: Partial<NewAdmin>): Promise<Admin> {
    await this.pool.query(
      `UPDATE admins SET
         full_name = COALESCE($2, full_name),
         status = COALESCE($3, status),
         role_id = COALESCE($4, role_id),
         updated_at = now()
       WHERE id = $1`,
      [id, patch.fullName ?? null, patch.status ?? null, patch.roleId ?? null]
    );
    const updated = await this.findById(id);
    if (!updated) throw new Error('Admin not found after update');
    return updated;
  }

  async touchLastLogin(id: string): Promise<void> {
    await this.pool.query('UPDATE admins SET last_login_at = now() WHERE id = $1', [id]);
  }

  async list(): Promise<Admin[]> {
    const { rows } = await this.pool.query<AdminRow>(`${SELECT_WITH_ROLE} ORDER BY a.created_at DESC`);
    return rows.map(toAdmin);
  }

  async listRoles(): Promise<Role[]> {
    const { rows } = await this.pool.query<{ id: string; name: string; permissions: Record<string, boolean> }>(
      'SELECT id, name, permissions FROM roles ORDER BY name'
    );
    return rows;
  }

  async findRoleByName(name: string): Promise<Role | null> {
    const { rows } = await this.pool.query<{ id: string; name: string; permissions: Record<string, boolean> }>(
      'SELECT id, name, permissions FROM roles WHERE name = $1',
      [name]
    );
    return rows[0] ?? null;
  }
}
