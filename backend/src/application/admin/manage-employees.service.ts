import { EmployeeRepository } from '../ports/employee-repository.port';
import { Employee, NewEmployee } from '../../domain/entities/employee';
import { PasswordHasher } from '../ports/token.port';
import { DomainError } from '../../domain/errors/domain-error';

export class ManageEmployeesService {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly passwordHasher: PasswordHasher
  ) {}

  list(params: { search?: string; status?: string; page: number; pageSize: number }) {
    return this.employees.list(params);
  }

  async create(input: { email: string; fullName: string; password: string; team?: string }): Promise<Employee> {
    const existing = await this.employees.findByEmail(input.email);
    if (existing) {
      throw DomainError.conflict('An employee with this email already exists');
    }
    const passwordHash = await this.passwordHasher.hash(input.password);
    const newEmployee: NewEmployee = {
      email: input.email,
      fullName: input.fullName,
      passwordHash,
      team: input.team ?? null,
      status: 'active',
      monitoringConsentAt: null,
    };
    return this.employees.create(newEmployee);
  }

  async update(
    id: string,
    patch: Partial<Pick<Employee, 'fullName' | 'team' | 'status'>>
  ): Promise<Employee> {
    return this.employees.update(id, patch);
  }
}
