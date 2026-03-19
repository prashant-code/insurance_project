import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cluster from 'cluster';
import os from 'os';
import authRoutes from './routes/rest_auth.js';
import calculationRoutes from './routes/rest_calculations.js';
import bulkRoutes from './routes/rest_bulk.js';
import { logger } from './utils/logger.js';
import { metricsMiddleware, register } from './utils/metrics.js';
import { rateLimiterMiddleware } from './utils/redis.js';
import { startWorker } from './workers/calculationWorker.js';

dotenv.config();

const numCPUs = os.cpus().length;
const PORT = process.env.PORT || 5000;

if (cluster.isPrimary) {
  logger.info(`Master process ${process.pid} is running`);
  
  // Kick off the horizontal background worker only once on the master process
  // This solves the 'chicken-egg' problem of worker duplication across cluster forks
  setTimeout(() => startWorker(), 2000);

  // Fork workers for each CPU core (Enterprise Scaling)
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on('exit', (worker, code, signal) => {
    logger.warn(`Worker ${worker.process.pid} died. Forking a replacement...`);
    cluster.fork();
  });
} else {
  // Worker processes handle the HTTP traffic
  const app = express();

  // Robust Security: Strict CSP and Restrictive CORS
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // unsafe-inline for React/Vite development
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https://images.unsplash.com"],
        connectSrc: ["'self'", process.env.VITE_API_URL || "http://localhost:3000"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
  }));

  const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:5173'];
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('❌ Restricted by CORS Security Policy'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie']
  }));

  app.use(express.json());
  app.use(cookieParser());

  // Metrics & High Security Rate Limiting
  app.use(metricsMiddleware);
  app.use(rateLimiterMiddleware);

  // Expose Prometheus Metrics endpoint
  app.get('/metrics', async (req, res) => {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  });

  // Unified Security Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/calculations', calculationRoutes);
  app.use('/api/bulk', bulkRoutes);

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'OK', worker: process.pid, engine: process.env.DB_ENGINE || 'postgres' });
  });

  app.listen(PORT, () => {
    logger.info(`Worker ${process.pid} started on port ${PORT}`);
  });
}
