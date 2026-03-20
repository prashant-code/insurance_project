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
  const user_id = req.user.id;

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

router.get('/:batch_id/results', verifyAuth, async (req, res) => {
  const { batch_id } = req.params;
  try {
    const result = await db.query(`
      SELECT r.id as request_id, r.product_id, r.age, r.policy_term, r.premium_amount, r.status, res.projected_benefits
      FROM illustration_requests r
      LEFT JOIN illustration_results res ON r.id = res.request_id
      WHERE r.batch_id = $1 AND r.user_id = $2
    `, [batch_id, req.user.id]);
    
    res.json({ batch_id, results: result.rows });
  } catch (error) {
    logger.error('Failed to fetch batch results:', error);
    res.status(500).json({ error: 'Failed to fetch batch results.' });
  }
});

// Delete a single illustration request by ID (cascades to illustration_results via ON DELETE CASCADE)
router.delete('/:request_id', verifyAuth, async (req, res) => {
  const { request_id } = req.params;
  try {
    // Ownership check — user can only delete their own requests
    const check = await db.query(
      `SELECT id FROM illustration_requests WHERE id = $1 AND user_id = $2`,
      [request_id, req.user.id]
    );
    if (check.rowCount === 0) {
      return res.status(404).json({ error: 'Request not found or access denied.' });
    }

    // Deleting the request automatically deletes the linked result
    // because illustration_results.request_id has ON DELETE CASCADE
    await db.query(`DELETE FROM illustration_requests WHERE id = $1`, [request_id]);

    logger.info(`[Delete] Request ${request_id} and its result deleted by user ${req.user.id}`);
    res.json({ message: 'Request and associated result deleted successfully.', request_id });
  } catch (error) {
    logger.error('Delete Request Error:', error);
    res.status(500).json({ error: 'Failed to delete request.' });
  }
});

// Delete an entire batch and all its requests + results
router.delete('/batch/:batch_id', verifyAuth, async (req, res) => {
  const { batch_id } = req.params;
  try {
    // Ownership check — ensure the batch belongs to this user
    const check = await db.query(
      `SELECT COUNT(*) FROM illustration_requests WHERE batch_id = $1 AND user_id = $2`,
      [batch_id, req.user.id]
    );
    if (parseInt(check.rows[0].count) === 0) {
      return res.status(404).json({ error: 'Batch not found or access denied.' });
    }

    // Delete all requests for this batch — cascade removes all linked results too
    const result = await db.query(
      `DELETE FROM illustration_requests WHERE batch_id = $1 AND user_id = $2 RETURNING id`,
      [batch_id, req.user.id]
    );

    logger.info(`[Delete] Batch ${batch_id} deleted — ${result.rowCount} requests removed by user ${req.user.id}`);
    res.json({
      message: `Batch deleted successfully.`,
      batch_id,
      deleted_requests: result.rowCount
    });
  } catch (error) {
    logger.error('Delete Batch Error:', error);
    res.status(500).json({ error: 'Failed to delete batch.' });
  }
});

export default router;
