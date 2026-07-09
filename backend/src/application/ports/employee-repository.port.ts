import { Employee, NewEmployee } from '../../domain/entities/employee';

export interface EmployeeRepository {
  findById(id: string): Promise<Employee | null>;
  findByEmail(email: string): Promise<Employee | null>;
  create(employee: NewEmployee): Promise<Employee>;
  update(id: string, patch: Partial<NewEmployee>): Promise<Employee>;
  list(params: { search?: string; status?: string; page: number; pageSize: number }): Promise<{
    items: Employee[];
    total: number;
  }>;
}
