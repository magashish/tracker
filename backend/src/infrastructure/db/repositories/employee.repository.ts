import { Pool } from 'pg';
import { EmployeeRepository } from '../../../application/ports/employee-repository.port';
import { Employee, NewEmployee } from '../../../domain/entities/employee';
import { DomainError } from '../../../domain/errors/domain-error';

interface EmployeeRow {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  team: string | null;
  status: Employee['status'];
  monitoring_consent_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function toEmployee(row: EmployeeRow): Employee {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    fullName: row.full_name,
    team: row.team,
    status: row.status,
    monitoringConsentAt: row.monitoring_consent_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PostgresEmployeeRepository implements EmployeeRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<Employee | null> {
    const { rows } = await this.pool.query<EmployeeRow>('SELECT * FROM employees WHERE id = $1', [id]);
    return rows[0] ? toEmployee(rows[0]) : null;
  }

  async findByEmail(email: string): Promise<Employee | null> {
    const { rows } = await this.pool.query<EmployeeRow>('SELECT * FROM employees WHERE email = $1', [email]);
    return rows[0] ? toEmployee(rows[0]) : null;
  }

  async create(employee: NewEmployee): Promise<Employee> {
    const { rows } = await this.pool.query<EmployeeRow>(
      `INSERT INTO employees (email, password_hash, full_name, team, status, monitoring_consent_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [employee.email, employee.passwordHash, employee.fullName, employee.team, employee.status, employee.monitoringConsentAt]
    );
    return toEmployee(rows[0]!);
  }

  async update(id: string, patch: Partial<NewEmployee>): Promise<Employee> {
    const { rows } = await this.pool.query<EmployeeRow>(
      `UPDATE employees SET
         full_name = COALESCE($2, full_name),
         team = COALESCE($3, team),
         status = COALESCE($4, status),
         updated_at = now()
       WHERE id = $1 RETURNING *`,
      [id, patch.fullName ?? null, patch.team ?? null, patch.status ?? null]
    );
    if (!rows[0]) {
      throw DomainError.notFound('Employee not found');
    }
    return toEmployee(rows[0]);
  }

  async list(params: {
    search?: string;
    status?: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: Employee[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (params.search) {
      values.push(`%${params.search}%`);
      conditions.push(`(full_name ILIKE $${values.length} OR email ILIKE $${values.length})`);
    }
    if (params.status) {
      values.push(params.status);
      conditions.push(`status = $${values.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM employees ${where}`,
      values
    );

    values.push(params.pageSize, (params.page - 1) * params.pageSize);
    const { rows } = await this.pool.query<EmployeeRow>(
      `SELECT * FROM employees ${where} ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    return { items: rows.map(toEmployee), total: Number(countResult.rows[0]?.count ?? 0) };
  }
}
