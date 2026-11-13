import { describe, expect, it, vi } from 'vitest';
import { PeriodService } from '../../src/modules/attendance/application/period-service';
import type { EffectiveFactoryReader } from '../../src/modules/attendance/application/effective-factory-reader';
import type { PeriodRepository } from '../../src/modules/attendance/application/period-repository';

describe('DIP: period export depends on ports', () => {
  it('exports through an injected effective reader without constructing Prisma or query services', async () => {
    const period = {
      id: 'period-1',
      factory: 'BINH_DUONG' as const,
      month: '2026-10',
      status: 'FINALIZED' as const,
      revision: 2,
      finalizedAt: new Date('2026-11-01T00:00:00Z'),
      finalizedBy: 'hr-1',
    };
    const get = vi.fn().mockResolvedValue(period);
    const periods = {
      get,
      finalize: vi.fn(),
    } satisfies PeriodRepository;
    const effectiveForFactory = vi.fn().mockResolvedValue({
      entries: [],
      total: 0,
      limit: 10,
      offset: 0,
    });
    const reader = { effectiveForFactory } satisfies EffectiveFactoryReader;
    const service = new PeriodService(periods, reader);

    await expect(
      service.export(
        'BINH_DUONG',
        '2026-10',
        {
          sub: 'integration-1',
          role: 'INTEGRATION',
          factories: ['BINH_DUONG'],
          employeeIds: [],
        },
        10,
        0,
      ),
    ).resolves.toMatchObject({ revision: 2, entries: [] });
    expect(effectiveForFactory).toHaveBeenCalledOnce();
    expect(get).toHaveBeenCalledTimes(2);
  });
});
