import type { Principal } from './identity';
import type { Factory } from './attendance';

export function canReadFactory(
  principal: Principal,
  factory: Factory,
): boolean {
  return principal.role === 'EMPLOYEE' || principal.factories.includes(factory);
}

export function canReadEmployee(
  principal: Principal,
  employeeId: string,
): boolean {
  if (principal.role === 'EMPLOYEE') return principal.sub === employeeId;
  if (principal.role === 'SUPERVISOR')
    return principal.employeeIds.includes(employeeId);
  return principal.role === 'HR';
}
