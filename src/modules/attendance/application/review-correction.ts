import type { Principal } from '../domain/identity';
import type { CorrectionReviewer } from './correction-repository';
import { AttendanceRuleError } from './errors';

export class ReviewCorrection {
  constructor(private readonly reviewer: CorrectionReviewer) {}

  async execute(
    id: string,
    principal: Principal,
    approve: boolean,
    reason: string,
  ) {
    if (principal.role !== 'HR')
      throw new AttendanceRuleError('HR role required', 403);
    const correction = await this.reviewer.find(id);
    if (!correction) throw new AttendanceRuleError('Correction not found', 404);
    if (!principal.factories.includes(correction.factory))
      throw new AttendanceRuleError('Factory outside authorized scope', 403);
    if (correction.requestedBy === principal.sub)
      throw new AttendanceRuleError(
        'Requester cannot review own correction',
        403,
      );
    if (correction.status !== 'PENDING')
      throw new AttendanceRuleError('Correction already reviewed', 409);
    const reviewed = await this.reviewer.review(
      id,
      principal.sub,
      approve,
      reason,
    );
    if (!reviewed)
      throw new AttendanceRuleError('Correction already reviewed', 409);
    return reviewed;
  }
}
