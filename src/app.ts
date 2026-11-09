import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { openApiDocument } from './openapi';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.get('/health', (_request, response) => {
    response.status(200).json({ status: 'ok' });
  });
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  return app;
}
