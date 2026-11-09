export interface AuditOutboxEvent {
  id: string;
  eventType: string;
  aggregateId: string;
  actorId: string;
  payload: unknown;
  createdAt: Date;
  deliveredAt: Date | null;
}

export interface AuditOutboxRepository {
  pending(limit: number): Promise<AuditOutboxEvent[]>;
  acknowledge(id: string): Promise<boolean>;
}
