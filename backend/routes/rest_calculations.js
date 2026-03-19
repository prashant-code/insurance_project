import express from 'express';
import { authAndValidate } from '../middleware/validate.js';
import { verifyAuth } from '../middleware/auth.js';
import { generateId } from '../utils/uuid.js';
import db from '../config/database.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

const calculationSchema = {
  type: 'object',
  properties: {
    product_id: { type: 'string', format: 'uuid' },
    age: { type: 'integer', minimum: 18, maximum: 65 },
    policy_term: { type: 'integer', minimum: 5, maximum: 50 },
    premium_payment_term: { type: 'integer', minimum: 1 },
    premium_amount: { type: 'number', minimum: 1000 }
  },
  required: ['product_id', 'age', 'policy_term', 'premium_payment_term', 'premium_amount'],
  additionalProperties: false
};

// Pure mathematical engine
// For exact replication of the Excel logic, equations should be dynamically adjusted here.
export const calculateBenefits = (age, policy_term, premium_payment_term, premium_amount) => {
  age = Number(age);
  policy_term = Number(policy_term);
  premium_payment_term = Number(premium_payment_term);
  premium_amount = Number(premium_amount);

  const projected_benefits = [];
  let current_corpus = 0;
  const ASSUMED_INTEREST_RATE = 0.08; // 8%

  for (let year = 1; year <= policy_term; year++) {
    const premium_paid = year <= premium_payment_term ? premium_amount : 0;
    current_corpus += premium_paid; // Premium paid
    current_corpus += (current_corpus * ASSUMED_INTEREST_RATE); // Interest accrued
    
    projected_benefits.push({
      year,
      age: age + year,
      premium_paid,
      projected_fund_value: parseFloat(current_corpus.toFixed(2)),
      death_benefit: parseFloat(Math.max(premium_amount * 10, current_corpus).toFixed(2))
    });
  }
  return projected_benefits;
};

// Single robust UI calculation endpoint
router.post('/calculate', authAndValidate(calculationSchema, verifyAuth), async (req, res) => {
  const { product_id, age, policy_term, premium_payment_term, premium_amount } = req.body;
  
  if (premium_payment_term > policy_term) {
    return res.status(400).json({ error: 'Premium payment term cannot exceed policy term.' });
  }

  if (age + policy_term > 85) {
    return res.status(400).json({ error: 'Maximum projection maturity age cannot exceed 85.' });
  }

  // Determine user ID securely from authenticated user
  const user_id = req.user.id;
  const request_id = generateId();

  try {
    // Actively query the 'products' table to validate it exists and is active.
    const productCheck = await db.query('SELECT id FROM products WHERE id = $1 AND is_active = TRUE', [product_id]);
    if (productCheck.rowCount === 0) {
      return res.status(400).json({ error: 'Selected insurance product is invalid or inactive.' });
    }

    // Insert robust tracking
    const reqInsert = `
      INSERT INTO illustration_requests (id, user_id, product_id, age, policy_term, premium_payment_term, premium_amount, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'COMPLETED')
    `;
    await db.query(reqInsert, [request_id, user_id, product_id, age, policy_term, premium_payment_term, premium_amount]);

    // Perform massive CPU bounds check and math logic
    const projected_benefits = calculateBenefits(age, policy_term, premium_payment_term, premium_amount);

    // Persist as a highly-efficient JSONB object structure
    const resInsert = `
      INSERT INTO illustration_results (id, request_id, projected_benefits)
      VALUES ($1, $2, $3)
    `;
    await db.query(resInsert, [generateId(), request_id, JSON.stringify(projected_benefits)]);

    res.status(200).json({
      request_id,
      status: 'SUCCESS',
      data: projected_benefits
    });
    
  } catch (error) {
    logger.error('Calculation Error:', error);
    res.status(500).json({ error: 'Internal Server Error calculating policy.' });
  }
});

export default router;
