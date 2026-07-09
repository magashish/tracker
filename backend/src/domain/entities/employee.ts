export type EmployeeStatus = 'active' | 'suspended' | 'deactivated';

export interface Employee {
  id: string;
  email: string;
  passwordHash: string;
  fullName: string;
  team: string | null;
  status: EmployeeStatus;
  monitoringConsentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type NewEmployee = Omit<Employee, 'id' | 'createdAt' | 'updatedAt'>;
