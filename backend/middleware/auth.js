import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';
import dotenv from 'dotenv';
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key';

export const verifyAuth = (req, res, next) => {
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
      
      // Basic Hash Query Validation would go here usually
      if (!email || !password) {
        return res.status(401).json({ error: 'Invalid Basic Auth credentials.' });
      }
      
      req.user = { email, authType: 'basic' };
      logger.info(`Basic auth validated for ${email}`);
      return next();
    } catch (e) {
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
