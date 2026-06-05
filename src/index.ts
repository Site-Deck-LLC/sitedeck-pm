import express, { Application } from 'express';
import path from 'path';
import apiRoutes from './routes';
import { errorHandlerMiddleware } from './lib/error-handler';

export function createApp(): Application {
  const app = express();

  app.use(express.json());

  // Serve React frontend build if it exists
  const frontendDist = path.join(__dirname, '../frontend/dist');
  app.use(express.static(frontendDist, { maxAge: 0, etag: false, lastModified: false }));

  app.use('/api/v1', apiRoutes);

  // SPA catch-all: serve index.html for any non-API route
  app.get('*', (_req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });

  app.use(errorHandlerMiddleware);

  return app;
}

const app = createApp();

export default app;
