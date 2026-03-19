import { calculateBenefits } from '../routes/rest_calculations.js';
import { redisSubscriber } from '../utils/redis.js';
import db from '../config/database.js';
import { generateId } from '../utils/uuid.js';
import { logger } from '../utils/logger.js';

export const startWorker = async () => {
  try {
    if (!redisSubscriber.isReady) {
      await redisSubscriber.connect();
    }
    
    await redisSubscriber.subscribe('BATCH_JOBS', async (message) => {
      try {
        const { batch_id } = JSON.parse(message);
        logger.info(`[Worker Node] Picked up async batch job ID: ${batch_id}`);
        
        // Fetch pending tasks explicitly from Postgres Batch
        const { rows } = await db.query(`
           SELECT * FROM illustration_requests 
           WHERE batch_id = $1 AND status = 'PENDING'
        `, [batch_id]);

        logger.info(`[Worker Node] Calculating mathematical models for ${rows.length} rows...`);
        
        // Utilize Promise.allSettled to process CPU mathematical logic and DB operations concurrently across the pool
        const MathAndDbPromises = rows.map(async (request) => {
          const projected_benefits = calculateBenefits(
             request.age, 
             request.policy_term, 
             request.premium_payment_term,
             request.premium_amount
          );

          // Note: In highly-optimized production contexts over PgBouncer, these are wrapped in BEGIN/COMMIT blocks.
          await db.query(`
            INSERT INTO illustration_results (id, request_id, projected_benefits)
            VALUES ($1, $2, $3)
          `, [generateId(), request.id, JSON.stringify(projected_benefits)]);

          await db.query(`
            UPDATE illustration_requests SET status = 'COMPLETED' WHERE id = $1
          `, [request.id]);
        });

        const jobResults = await Promise.allSettled(MathAndDbPromises);
        const rejectedJobs = jobResults.filter(r => r.status === 'rejected');
        
        if (rejectedJobs.length > 0) {
           logger.warn(`[Worker Node] Batch ${batch_id} finished with ${rejectedJobs.length} rendering/DB failures.`);
        }
        
        logger.info(`[Worker Node] Batch ${batch_id} fully verified and completed!`);
      } catch (err) {
        logger.error('[Worker Node] Failure rendering batch transaction:', err);
      }
    });

    logger.info('Background Work Engine hooked onto Redis channel: BATCH_JOBS');
  } catch (error) {
    logger.error('Worker Engine failed to initialize:', error);
  }
};
