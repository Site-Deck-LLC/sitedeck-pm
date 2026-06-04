import express, { Application } from 'express';
import apiRoutes from './routes';
import { errorHandlerMiddleware } from './lib/error-handler';

export function createApp(): Application {
  const app = express();

  app.use(express.json());

  app.use('/api/v1', apiRoutes);

  app.use(errorHandlerMiddleware);

  return app;
}

const app = createApp();

export default app;
