import { PrismaClient } from '@prisma/client';
import type { AuditOutboxRepository } from '../application/audit-outbox-repository';

export class PrismaAuditOutboxRepository implements AuditOutboxRepository {
  constructor(private readonly prisma: PrismaClient) {}

  pending(limit: number) {
    return this.prisma.auditOutbox.findMany({
      where: { deliveredAt: null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit,
    });
  }

  async acknowledge(id: string) {
    const updated = await this.prisma.auditOutbox.updateMany({
      where: { id, deliveredAt: null },
      data: { deliveredAt: new Date() },
    });
    if (updated.count > 0) return true;
    return (
      (await this.prisma.auditOutbox.findUnique({
        where: { id },
        select: { id: true },
      })) !== null
    );
  }
}
