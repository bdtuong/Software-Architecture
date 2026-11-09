import { Router } from 'express';
import { z } from 'zod';
import type { TokenVerifier } from '../../../config/auth';
import type { AuditOutboxRepository } from '../application/audit-outbox-repository';
import { principalOf, requirePrincipal } from './auth-middleware';

export function auditOutboxRoutes(
  repository: AuditOutboxRepository,
  verify: TokenVerifier,
) {
  const router = Router();
  router.use(requirePrincipal(verify));
  router.use((request, response, next) => {
    if (principalOf(request).role !== 'REPORTING') {
      response.status(403).json({ error: 'Reporting service role required' });
      return;
    }
    next();
  });
  router.get('/events', async (_request, response, next) => {
    try {
      response.json({ events: await repository.pending(100) });
    } catch (error) {
      next(error);
    }
  });
  router.post('/events/:id/ack', async (request, response, next) => {
    if (!z.string().uuid().safeParse(request.params.id).success) {
      response.status(400).json({ error: 'Invalid audit event ID' });
      return;
    }
    try {
      if (!(await repository.acknowledge(request.params.id!))) {
        response.status(404).json({ error: 'Audit event not found' });
        return;
      }
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });
  return router;
}
