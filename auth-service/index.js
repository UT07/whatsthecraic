const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

const app = express();
const port = process.env.PORT || process.env.AUTH_SERVICE_PORT || 3001;

// Middleware to parse JSON requests
app.use(express.json());
app.use(cors());

const DB_HOST = process.env.DB_HOST || 'db';
const DB_PORT = process.env.DB_PORT || '3306';
const DB_USER = process.env.DB_USER || 'app';
const DB_PASSWORD = process.env.DB_PASSWORD || 'app';
const DB_NAME = process.env.DB_NAME || 'gigsdb';
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('JWT_SECRET is required. Set it in your environment.');
  process.exit(1);
}

// Create a MySQL connection pool
const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

app.use((req, res, next) => {
  const requestId = crypto.randomUUID();
  req.requestId = requestId;
  res.set('X-Request-Id', requestId);
  const started = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - started;
    console.log(`[${requestId}] ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`);
  });
  next();
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false
});

const sendError = (res, status, code, message, details) => {
  return res.status(status).json({
    error: {
      code,
      message,
      details,
      requestId: res.get('X-Request-Id')
    }
  });
};

// Endpoint for user signup
app.post('/auth/signup', authLimiter, async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(8)
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, 'invalid_body', 'Invalid request body', parsed.error.flatten());
    }
    const { name, email, password } = parsed.data;

    // Check if the user already exists
    const [existing] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return sendError(res, 400, 'user_exists', 'User already exists');
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    // Insert new user into the database
    await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)',
      [name, email, hashedPassword]
    );

    return res.status(201).json({ message: 'User created successfully' });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'internal_error', 'Server error');
  }
});

// Endpoint for user login
app.post('/auth/login', authLimiter, async (req, res) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(1)
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, 'invalid_body', 'Invalid request body', parsed.error.flatten());
    }
    const { email, password } = parsed.data;

    // Find the user by email
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return sendError(res, 401, 'invalid_credentials', 'Invalid credentials');
    }
    const user = rows[0];

    // Check the password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return sendError(res, 401, 'invalid_credentials', 'Invalid credentials');
    }

    // Generate a JWT token that expires in 1 hour
    const token = jwt.sign(
      { user_id: user.id },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    return res.status(200).json({
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (err) {
    console.error(err);
    return sendError(res, 500, 'internal_error', 'Server error');
  }
});

// A simple health check endpoint
app.get('/', (req, res) => {
  res.send('Authentication API is running');
});
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  return sendError(res, 500, 'internal_error', 'Server error');
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
