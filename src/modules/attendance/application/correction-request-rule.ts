import type { AttendanceRecordLookup } from './attendance-repository';
import type { CorrectionKind, NewCorrection } from '../domain/correction';
import { AttendanceRuleError } from './errors';

export interface CorrectionRequestRule {
  readonly kind: CorrectionKind;
  validate(
    input: NewCorrection,
    records: AttendanceRecordLookup,
  ): Promise<void>;
}

async function requireMatchingTarget(
  input: NewCorrection,
  records: AttendanceRecordLookup,
) {
  if (!input.targetRecordId)
    throw new AttendanceRuleError('Target record required', 400);
  const target = await records.findRecord(input.targetRecordId);
  if (!target) throw new AttendanceRuleError('Target record not found', 404);
  if (
    target.employeeId !== input.employeeId ||
    target.factory !== input.factory
  )
    throw new AttendanceRuleError(
      'Target does not match employee and factory',
      400,
    );
}

export const defaultCorrectionRequestRules: ReadonlyMap<
  CorrectionKind,
  CorrectionRequestRule
> = new Map([
  [
    'ADD',
    {
      kind: 'ADD',
      async validate(input) {
        if (input.targetRecordId)
          throw new AttendanceRuleError('ADD cannot target a record', 400);
        if (!input.direction || !input.occurredAt)
          throw new AttendanceRuleError(
            'ADD requires direction and occurredAt',
            400,
          );
      },
    },
  ],
  [
    'REPLACE',
    {
      kind: 'REPLACE',
      async validate(input, records) {
        await requireMatchingTarget(input, records);
        if (!input.direction || !input.occurredAt)
          throw new AttendanceRuleError(
            'REPLACE requires direction and occurredAt',
            400,
          );
      },
    },
  ],
  [
    'VOID',
    {
      kind: 'VOID',
      async validate(input, records) {
        await requireMatchingTarget(input, records);
        if (input.direction || input.occurredAt)
          throw new AttendanceRuleError(
            'VOID cannot contain replacement fields',
            400,
          );
      },
    },
  ],
]);
