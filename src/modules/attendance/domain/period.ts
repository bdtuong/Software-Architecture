import type { Factory } from './attendance';

export type PeriodStatus = 'OPEN' | 'FINALIZED' | 'REOPEN_REQUIRED';
export interface AttendancePeriod {
  id: string;
  factory: Factory;
  month: string;
  status: PeriodStatus;
  revision: number;
  finalizedAt: Date | null;
  finalizedBy: string | null;
}

export function vietnamMonth(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
  }).format(date);
}

export function monthBounds(month: string): { start: Date; end: Date } {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(month))
    throw new Error('Invalid month');
  const [year, number] = month.split('-').map(Number);
  return {
    start: new Date(Date.UTC(year!, number! - 1, 1, -7)),
    end: new Date(Date.UTC(year!, number!, 1, -7)),
  };
}
