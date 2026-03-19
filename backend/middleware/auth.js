import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { logger } from '../utils/logger.js';
import dotenv from 'dotenv';
import db from '../config/database.js';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

export const verifyAuth = async (req, res, next) => {
  let token = req.cookies?.token;
  const authHeader = req.headers.authorization;

  if (!token && authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token && !authHeader) {
    return res.status(401).json({ error: 'Access denied. No authentication provided.' });
  }

  // Handle Basic Auth
  if (!token && authHeader && authHeader.startsWith('Basic ')) {
    try {
      const b64auth = authHeader.split(' ')[1] || '';
      const [email, password] = Buffer.from(b64auth, 'base64').toString('ascii').split(':');
      
      if (!email || !password) {
        return res.status(401).json({ error: 'Invalid Basic Auth credentials.' });
      }

      // Enhanced Basic Auth: Validate user against DB and retrieve ID
      const userResult = await db.query('SELECT id, email, password_hash, role FROM users WHERE email = $1', [email]);
      if (userResult.rowCount === 0) {
        return res.status(401).json({ error: 'Invalid credentials.' });
      }

      const user = userResult.rows[0];
      const passwordMatch = await bcrypt.compare(password, user.password_hash);
      if (!passwordMatch) {
         return res.status(401).json({ error: 'Invalid credentials.' });
      }
      
      req.user = { 
        id: user.id, 
        email: user.email, 
        role: user.role,
        authType: 'basic' 
      };
      
      logger.info(`Basic auth validated for ${email}`);
      return next();
    } catch (e) {
      logger.error(`Basic auth error: ${e.message}`);
      return res.status(401).json({ error: 'Basic auth validation failed.' });
    }
  }

  // Handle JWT Auth
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded; 
      return next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid or expired JWT token.' });
    }
  }

  return res.status(401).json({ error: 'Unsupported authentication method.' });
};
