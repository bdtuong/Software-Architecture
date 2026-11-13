import express from 'express';
import swaggerUi from 'swagger-ui-express';
import type { TokenVerifier } from './config/auth';
import { AttendanceService } from './modules/attendance/application/attendance-service';
import {
  AttendanceRuleError,
  EventIdConflictError,
} from './modules/attendance/application/errors';
import { AttendanceQueryService } from './modules/attendance/application/attendance-query-service';
import { RequestCorrection } from './modules/attendance/application/request-correction';
import { ReviewCorrection } from './modules/attendance/application/review-correction';
import { ListCorrections } from './modules/attendance/application/list-corrections';
import type { AuditOutboxRepository } from './modules/attendance/application/audit-outbox-repository';
import { auditOutboxRoutes } from './modules/attendance/presentation/audit-outbox-routes';
import { PeriodService } from './modules/attendance/application/period-service';
import { attendanceRoutes } from './modules/attendance/presentation/attendance-routes';
import { openApiDocument } from './openapi';

export interface AttendanceDependencies {
  attendance: AttendanceService;
  query: AttendanceQueryService;
  requestCorrection: RequestCorrection;
  reviewCorrection: ReviewCorrection;
  listCorrections: ListCorrections;
  periods: PeriodService;
  verify: TokenVerifier;
  auditOutbox?: AuditOutboxRepository;
}

export function createApp(dependencies?: AttendanceDependencies) {
  const app = express();
  app.use(express.json());
  app.get('/health', (_request, response) =>
    response.status(200).json({ status: 'ok' }),
  );
  if (dependencies)
    app.use(
      '/api/attendance',
      attendanceRoutes(
        dependencies.attendance,
        dependencies.query,
        dependencies.requestCorrection,
        dependencies.reviewCorrection,
        dependencies.listCorrections,
        dependencies.verify,
        dependencies.periods,
      ),
    );
  if (dependencies?.auditOutbox)
    app.use(
      '/internal/audit-outbox',
      auditOutboxRoutes(dependencies.auditOutbox, dependencies.verify),
    );
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.use(
    (
      error: unknown,
      _request: express.Request,
      response: express.Response,
      next: express.NextFunction,
    ) => {
      void next;
      if (error instanceof SyntaxError && 'body' in error) {
        response.status(400).json({ error: 'Invalid JSON body' });
        return;
      }
      if (error instanceof EventIdConflictError) {
        response.status(409).json({ error: error.message });
        return;
      }
      if (error instanceof AttendanceRuleError) {
        response.status(error.status).json({ error: error.message });
        return;
      }
      console.error(error);
      response
        .status(503)
        .json({ error: 'Attendance service temporarily unavailable' });
    },
  );
  return app;
}
