import { AdminRepository } from '../ports/admin-repository.port';
import { Admin } from '../../domain/entities/admin';
import { PasswordHasher } from '../ports/token.port';
import { DomainError } from '../../domain/errors/domain-error';

export class ManageAdminsService {
  constructor(
    private readonly admins: AdminRepository,
    private readonly passwordHasher: PasswordHasher
  ) {}

  list(): Promise<Admin[]> {
    return this.admins.list();
  }

  listRoles() {
    return this.admins.listRoles();
  }

  async create(input: { email: string; fullName: string; password: string; roleName: string }): Promise<Admin> {
    const existing = await this.admins.findByEmail(input.email);
    if (existing) {
      throw DomainError.conflict('An admin with this email already exists');
    }
    const role = await this.admins.findRoleByName(input.roleName);
    if (!role) {
      throw DomainError.validation(`Unknown role: ${input.roleName}`);
    }
    const passwordHash = await this.passwordHasher.hash(input.password);
    return this.admins.create({
      email: input.email,
      fullName: input.fullName,
      passwordHash,
      roleId: role.id,
      status: 'active',
    });
  }

  async update(
    id: string,
    patch: { fullName?: string; status?: 'active' | 'disabled'; roleName?: string }
  ): Promise<Admin> {
    let roleId: string | undefined;
    if (patch.roleName) {
      const role = await this.admins.findRoleByName(patch.roleName);
      if (!role) {
        throw DomainError.validation(`Unknown role: ${patch.roleName}`);
      }
      roleId = role.id;
    }
    return this.admins.update(id, {
      fullName: patch.fullName,
      status: patch.status,
      roleId,
    });
  }
}
