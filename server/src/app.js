// Builds the Express app without starting a server, so it can run both
// locally (src/index.js → app.listen) and on Vercel as a serverless function (api/index.js).
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDB } from './config/db.js';
import { corsOrigin, CSP_DIRECTIVES, SECURITY_HEADERS } from './config/security.js';
import { authenticate } from './middleware/auth.js';
import { errorHandler } from './middleware/error.js';
import { HttpError } from './utils/http.js';
import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import loginHistoryRoutes from './routes/loginHistory.js';
import medicineRoutes from './routes/medicines.js';
import patientRoutes from './routes/patients.js';
import reportRoutes from './routes/reports.js';
import roleRoutes from './routes/roles.js';
import stockRoutes from './routes/stock.js';
import usageRoutes from './routes/usage.js';
import userRoutes from './routes/users.js';

export function createApp({ serveClient = false } = {}) {
  const app = express();
  // Plain key=value query strings only: "?status[$ne]=x" stays a literal key instead of
  // becoming a MongoDB operator object.
  app.set('query parser', 'simple');
  if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);

  app.disable('x-powered-by');
  app.use(
    helmet({
      // explicit policy (no upgrade-insecure-requests, so http://localhost keeps working)
      contentSecurityPolicy: { useDefaults: false, directives: CSP_DIRECTIVES },
      frameguard: { action: 'deny' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use((_req, res, next) => {
    res.set('Permissions-Policy', SECURITY_HEADERS['Permissions-Policy']);
    next();
  });
  app.use(cors({ origin: corsOrigin() }));
  app.use(express.json({ limit: '1mb' }));
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'tiny' : 'dev'));

  // API responses contain patient data: never store them in any cache.
  app.use('/api', (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

  // Fail clearly instead of crashing when the deployment is missing its configuration.
  app.use('/api', (_req, _res, next) => {
    if (!process.env.JWT_SECRET) return next(new HttpError(500, 'Server is not configured: JWT_SECRET is missing'));
    if (!process.env.MONGO_URI && process.env.VERCEL) return next(new HttpError(500, 'Server is not configured: MONGO_URI is missing'));
    next();
  });

  // Make sure the database is connected (re-uses the connection between serverless invocations).
  app.use('/api', (_req, _res, next) => {
    connectDB().then(() => next(), next);
  });

  app.use('/api/auth', authRoutes);

  // everything below requires a logged-in user
  app.use('/api', authenticate);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/patients', patientRoutes);
  app.use('/api/medicines', medicineRoutes);
  app.use('/api/stock', stockRoutes);
  app.use('/api/usage', usageRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/roles', roleRoutes);
  app.use('/api/login-history', loginHistoryRoutes);
  app.use('/api', (_req, res) => res.status(404).json({ message: 'Not found' }));

  // Serve the built React app (client/dist) when running as a normal server.
  // On Vercel the static files are served by Vercel itself.
  if (serveClient) {
    const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
    if (fs.existsSync(dist)) {
      app.use(express.static(dist));
      app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
    }
  }

  app.use(errorHandler);
  return app;
}
