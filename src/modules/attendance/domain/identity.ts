import type { Factory } from './attendance';

export type AttendanceRole =
  | 'GATEWAY'
  | 'EMPLOYEE'
  | 'SUPERVISOR'
  | 'HR'
  | 'SECURITY'
  | 'EXECUTIVE'
  | 'ADMIN'
  | 'REPORTING'
  | 'INTEGRATION';

export interface Principal {
  sub: string;
  role: AttendanceRole;
  factories: Factory[];
  employeeIds: string[];
}
