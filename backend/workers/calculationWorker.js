import { calculateBenefits } from '../routes/rest_calculations.js';
import { redisSubscriber } from '../utils/redis.js';
import db from '../config/database.js';
import { generateId } from '../utils/uuid.js';
import { logger } from '../utils/logger.js';

// ─── Shared batch processor (used by both worker + orphan recovery) ───────────
const processBatch = async (batch_id) => {
  const { rows } = await db.query(`
    SELECT * FROM illustration_requests
    WHERE batch_id = $1 AND status = 'PENDING'
  `, [batch_id]);

  if (rows.length === 0) return; // Already processed

  logger.info(`[Worker] Processing ${rows.length} rows for batch ${batch_id}`);

  const jobs = rows.map(async (request) => {
    const projected_benefits = calculateBenefits(
      request.age,
      request.policy_term,
      request.premium_payment_term,
      request.premium_amount
    );

    await db.query(`
      INSERT INTO illustration_results (id, request_id, projected_benefits)
      VALUES ($1, $2, $3)
    `, [generateId(), request.id, JSON.stringify(projected_benefits)]);

    await db.query(`
      UPDATE illustration_requests SET status = 'COMPLETED' WHERE id = $1
    `, [request.id]);
  });

  const results = await Promise.allSettled(jobs);
  const failed = results.filter(r => r.status === 'rejected').length;
  if (failed > 0) {
    logger.warn(`[Worker] Batch ${batch_id} completed with ${failed} row failures.`);
  } else {
    logger.info(`[Worker] Batch ${batch_id} fully completed.`);
  }
};

// ─── Orphan Recovery — for batches left PENDING when Redis was down ────────────
// Runs once on startup and every 5 minutes thereafter.
const recoverOrphanedBatches = async () => {
  try {
    const { rows } = await db.query(`
      SELECT DISTINCT batch_id
      FROM illustration_requests
      WHERE status = 'PENDING'
        AND batch_id IS NOT NULL
        AND created_at < NOW() - INTERVAL '2 minutes'
    `);

    if (rows.length === 0) return;

    logger.warn(`[Orphan Recovery] Found ${rows.length} stuck batch(es). Processing now...`);
    for (const { batch_id } of rows) {
      await processBatch(batch_id);
    }
  } catch (err) {
    logger.error('[Orphan Recovery] Failed to recover orphaned batches:', err);
  }
};

export const startWorker = async () => {
  try {
    if (!redisSubscriber.isReady) {
      await redisSubscriber.connect();
    }

    // Subscribe to new batch jobs published via Redis Pub/Sub
    await redisSubscriber.subscribe('BATCH_JOBS', async (message) => {
      try {
        const { batch_id } = JSON.parse(message);
        logger.info(`[Worker] Picked up batch job: ${batch_id}`);
        await processBatch(batch_id);
      } catch (err) {
        logger.error('[Worker] Failed to process batch from Pub/Sub:', err);
      }
    });

    logger.info('[Worker] Subscribed to Redis channel: BATCH_JOBS');

    // Run orphan recovery immediately on startup
    // (catches any PENDING batches from when Redis was previously down)
    await recoverOrphanedBatches();

    // Then repeat every 5 minutes as a safety net
    setInterval(recoverOrphanedBatches, 5 * 60 * 1000);

  } catch (error) {
    logger.error('[Worker] Failed to initialize:', error);
  }
};
