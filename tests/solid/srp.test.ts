import { describe, expect, it, vi } from 'vitest';
import { RequestCorrection } from '../../src/modules/attendance/application/request-correction';
import { ReviewCorrection } from '../../src/modules/attendance/application/review-correction';
import type { AttendanceRecordLookup } from '../../src/modules/attendance/application/attendance-repository';
import type {
  CorrectionRequestWriter,
  CorrectionReviewer,
} from '../../src/modules/attendance/application/correction-repository';
import type { AttendanceCorrection } from '../../src/modules/attendance/domain/correction';

const input = {
  kind: 'ADD' as const,
  employeeId: 'E1',
  factory: 'BINH_DUONG' as const,
  direction: 'ENTRY' as const,
  occurredAt: new Date('2026-10-01T00:00:00Z'),
  reason: 'Verified manual gate log',
  requestedBy: 'E1',
};
const pending: AttendanceCorrection = {
  ...input,
  id: 'correction-1',
  targetRecordId: null,
  status: 'PENDING',
  requestedAt: new Date(),
  reviewedBy: null,
  reviewedAt: null,
  reviewReason: null,
};

describe('SRP: correction workflows', () => {
  it('keeps request creation independent of review operations', async () => {
    const lookup: AttendanceRecordLookup = { findRecord: vi.fn() };
    const create = vi.fn().mockResolvedValue(pending);
    const writer: CorrectionRequestWriter = { create };
    const request = new RequestCorrection(lookup, writer);

    await expect(
      request.execute(input, {
        sub: 'E1',
        role: 'EMPLOYEE',
        factories: [],
        employeeIds: [],
      }),
    ).resolves.toEqual(pending);
    expect(create).toHaveBeenCalledOnce();
    expect(lookup.findRecord).not.toHaveBeenCalled();
  });

  it('keeps review independent of request creation', async () => {
    const find = vi.fn().mockResolvedValue(pending);
    const review = vi.fn().mockResolvedValue({
      ...pending,
      status: 'APPROVED',
    });
    const reviewer: CorrectionReviewer = { find, review };
    const useCase = new ReviewCorrection(reviewer);

    await expect(
      useCase.execute(
        pending.id,
        {
          sub: 'hr-1',
          role: 'HR',
          factories: ['BINH_DUONG'],
          employeeIds: [],
        },
        true,
        'Gate log confirmed',
      ),
    ).resolves.toMatchObject({ status: 'APPROVED' });
    expect(review).toHaveBeenCalledWith(
      pending.id,
      'hr-1',
      true,
      'Gate log confirmed',
    );
  });
});
