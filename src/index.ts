import express, { Application } from 'express';
import path from 'path';
import apiRoutes from './routes';
import { errorHandlerMiddleware } from './lib/error-handler';
import { corsForSiteDeck } from './middleware/cors';

export function createApp(): Application {
  const app = express();

  // CORS must run before express.json so OPTIONS preflight works for
  // large bodies and before any other route logic.
  app.use(corsForSiteDeck);
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
