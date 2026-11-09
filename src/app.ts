import express from 'express';
import swaggerUi from 'swagger-ui-express';
import {
  AttendanceService,
  EventIdConflictError,
} from './modules/attendance/application/attendance-service';
import { attendanceRoutes } from './modules/attendance/presentation/attendance-routes';
import { openApiDocument } from './openapi';

export function createApp(attendance?: AttendanceService) {
  const app = express();
  app.use(express.json());
  app.get('/health', (_request, response) => {
    response.status(200).json({ status: 'ok' });
  });
  if (attendance) app.use('/api/attendance', attendanceRoutes(attendance));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.use(
    (
      error: unknown,
      _request: express.Request,
      response: express.Response,
      _next: express.NextFunction,
    ) => {
      void _next;
      if (error instanceof SyntaxError && 'body' in error) {
        response.status(400).json({ error: 'Invalid JSON body' });
        return;
      }
      if (error instanceof EventIdConflictError) {
        response.status(409).json({ error: error.message });
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
