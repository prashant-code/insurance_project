import pkg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pkg;
const DB_ENGINE = process.env.DB_ENGINE || 'postgres';

const dbConfig = {
  connectionString: process.env.DATABASE_URL,
};

if (DB_ENGINE === 'yugabyte') {
  dbConfig.max = 100;
  dbConfig.idleTimeoutMillis = 30000;
} else {
  dbConfig.max = 20;
  dbConfig.idleTimeoutMillis = 10000;
}

const pool = new Pool(dbConfig);

// Self-healing retry logic to solve the 'chicken-egg' database startup race condition
const connectWithRetry = async (retries = 5) => {
  while (retries) {
    try {
      await pool.query('SELECT 1');
      console.log('✅ Database connected successfully');
      break;
    } catch (err) {
      retries -= 1;
      console.error(`❌ DB connection failed. Retries left: ${retries}. Waiting 8s...`);
      await new Promise(res => setTimeout(res, 8000));
      if (retries === 0) {
        console.error('💥 Could not connect to DB after multiple retries. Exiting.');
        process.exit(1);
      }
    }
  }
};

connectWithRetry();

export const query = (text, params) => pool.query(text, params);
export default { query, pool, DB_ENGINE };
