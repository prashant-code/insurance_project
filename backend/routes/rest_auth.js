import express from 'express';
import { authAndValidate } from '../middleware/validate.js';
import { verifyAuth } from '../middleware/auth.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { generateId } from '../utils/uuid.js';
import { maskString, maskPhone, maskDate } from '../utils/encryption.js';

const router = express.Router();

const registerSchema = {
  type: 'object',
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string', minLength: 8 },
    first_name: { type: 'string' },
    last_name: { type: 'string' },
    dob: { type: 'string' },
    mobile_number: { type: 'string' }
  },
  required: ['email', 'password', 'first_name', 'last_name', 'dob', 'mobile_number'],
  additionalProperties: false
};

// Open route for user registration
router.post('/register', authAndValidate(registerSchema, (req, res, next) => next()), async (req, res) => {
  const { email, password, first_name, last_name, dob, mobile_number } = req.body;
  
  try {
    const existingUser = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rowCount > 0) {
      return res.status(400).json({ error: 'Email already registered.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const id = generateId();

    const insertQuery = `
      INSERT INTO users (id, email, password_hash, first_name, last_name, dob, mobile_number, role)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'CUSTOMER') RETURNING id, email, role
    `;
    const newUser = await db.query(insertQuery, [
      id, 
      email, 
      hashedPassword, 
      maskString(first_name), 
      maskString(last_name), 
      maskDate(dob), 
      maskPhone(mobile_number)
    ]);

    res.status(201).json({ message: 'User registered successfully', user: newUser.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Error registering user' });
  }
});

const loginSchema = {
  type: 'object',
  properties: {
    email: { type: 'string', format: 'email' },
    password: { type: 'string', minLength: 6 }
  },
  required: ['email', 'password'],
  additionalProperties: false
};

// Open route with AJV validation parsing credentials over DB
router.post('/login', authAndValidate(loginSchema, (req, res, next) => next()), async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const userResult = await db.query('SELECT id, email, password_hash, role FROM users WHERE email = $1', [email]);
    if (userResult.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = userResult.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET || 'super-secret-key', { expiresIn: '1h' });
    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 3600000 // 1 hour
    }).json({ message: 'Login successful' });
  } catch (error) {
    res.status(500).json({ error: 'Error logging in' });
  }
});

// Protected route combining verifyAuth and AJV validation arrays
const dummyProtectedSchema = {
  type: 'object',
  properties: { data: { type: 'string' } }
};
router.post('/secure-ping', authAndValidate(dummyProtectedSchema, verifyAuth), (req, res) => {
  res.json({ message: 'Secure ping accepted', user: req.user });
});

router.get('/me', verifyAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post('/logout', (req, res) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  }).json({ message: 'Logged out successfully' });
});

export default router;
