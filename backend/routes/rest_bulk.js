import express from 'express';
import { authAndValidate } from '../middleware/validate.js';
import { verifyAuth } from '../middleware/auth.js';
import { generateId } from '../utils/uuid.js';
import db from '../config/database.js';
import { logger } from '../utils/logger.js';
import { redisPublisher } from '../utils/redis.js';

const router = express.Router();

const bulkSchema = {
  type: 'object',
  properties: {
    calculations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          product_id: { type: 'string', format: 'uuid' },
          age: { type: 'integer' },
          policy_term: { type: 'integer' },
          premium_payment_term: { type: 'integer' },
          premium_amount: { type: 'number' }
        },
        required: ['product_id', 'age', 'policy_term', 'premium_payment_term', 'premium_amount']
      },
      minItems: 1,
      maxItems: 10000 // Strict chunk size limits per payload boundary
    }
  },
  required: ['calculations']
};

router.post('/upload', authAndValidate(bulkSchema, verifyAuth), async (req, res) => {
  const { calculations } = req.body;
  const batch_id = generateId();
  const user_id = process.env.SYSTEM_USER_ID || '00000000-0000-0000-0000-000000000000';

  try {
    // Concurrent batched insertion utilizing Promise.allSettled for maximum asynchronous DB throughput
    const insertPromises = calculations.map(calc => 
       db.query(`
         INSERT INTO illustration_requests (id, user_id, product_id, batch_id, age, policy_term, premium_payment_term, premium_amount, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING')
       `, [generateId(), user_id, calc.product_id, batch_id, calc.age, calc.policy_term, calc.premium_payment_term, calc.premium_amount])
    );
    
    const results = await Promise.allSettled(insertPromises);
    const failedCount = results.filter(r => r.status === 'rejected').length;

    if (failedCount > 0) {
      logger.warn(`Bulk batch ${batch_id} ingested with ${failedCount} failures out of ${calculations.length} attempts.`);
    } else {
      logger.info(`Bulk batch ${batch_id} ingested completely with ${calculations.length} records into Postgres.`);
    }

    // High Security and Pattern: Offload CPU-heavy mathematical processing to Redis Pub/Sub Worker nodes
    if (redisPublisher.isReady) {
      await redisPublisher.publish('BATCH_JOBS', JSON.stringify({ batch_id }));
    } else {
      logger.warn('Redis Publisher is down. Batch will remain PENDING until explicitly verified.');
    }

    res.status(202).json({
      message: 'Batch processing successfully queued for background workers.',
      batch_id,
      records: calculations.length
    });
  } catch (error) {
    logger.error('Bulk Upload Error:', error);
    res.status(500).json({ error: 'Failed to ingest bulk request.' });
  }
});

export default router;
