const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const axios = require('axios'); 
const crypto = require('crypto');
const { z } = require('zod');
// Load env vars or define defaults
const DB_HOST = process.env.DB_HOST || 'db';
const DB_PORT = process.env.DB_PORT || '3306';
const DB_USER = process.env.DB_USER || 'app';
const DB_PASSWORD = process.env.DB_PASSWORD || 'app';
const DB_NAME = process.env.DB_NAME || 'gigsdb';
const API_PORT = process.env.API_PORT || process.env.DJ_SERVICE_PORT || 4002;

// Create a connection pool
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

const app = express();
app.use(express.json());
app.use(cors());
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
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

const parseIdParam = (value) => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return null;
  return parsed;
};
  
const CONVERTER_API = 'https://5ss3rebhtf.execute-api.us-east-1.amazonaws.com/currencyConverter';
const http = axios.create({ timeout: 8000 });
/**
 * GET /djs
 * Fetch all DJs
 */

app.get('/djs', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM djs');
    res.json(rows);
  } catch (err) {
    console.error('Error fetching DJs:', err);
    res.status(500).json({ error: 'Failed to fetch DJs' });
  }
});


/**
 * GET /djs/:dj_id
 * Fetch one DJ by ID
 */
app.get('/djs/:dj_id', async (req, res) => {
  const djId = parseIdParam(req.params.dj_id);
  if (djId === null) {
    return sendError(res, 400, 'invalid_id', 'Invalid dj_id');
  }
  try {
    const [rows] = await pool.query('SELECT * FROM djs WHERE dj_id = ?', [djId]);
    if (rows.length === 0) {
      return sendError(res, 404, 'not_found', 'DJ not found');
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Error retrieving DJ:', err);
    return sendError(res, 500, 'internal_error', 'Failed to retrieve DJ');
  }
});

/**
 * POST /djs
 * Create a new DJ record
 */
app.post('/djs', async (req, res) => {
  const schema = z.object({
    dj_name: z.string().min(1),
    instagram: z.string().optional(),
    email: z.string().optional(),
    genres: z.string().optional(),
    soundcloud: z.string().optional(),
    city: z.string().optional(),
    phone: z.string().optional(),
    numeric_fee: z.coerce.number().nonnegative().optional(),
    currency: z.string().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'invalid_body', 'Invalid request body', parsed.error.flatten());
  }
  const {
    dj_name,
    instagram,
    email,
    genres,
    soundcloud,
    city,
    phone,
    numeric_fee,
    currency
  } = parsed.data;

  // Convert numeric_fee to float or default to 0
  const feeValue = numeric_fee ? parseFloat(numeric_fee) : 0.0;
  const currencyVal = currency || 'EUR';

  try {
    // Insert into 'djs' table
    await pool.execute(
      `INSERT INTO djs
        (dj_name, instagram, email, genres, soundcloud, city, phone, numeric_fee, currency)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        dj_name,
        instagram || '',
        email || '',
        genres || '',
        soundcloud || '',
        city || '',
        phone || '',
        feeValue,
        currencyVal
      ]
    );

    // Return the newly created record
    const [rows] = await pool.query(
      'SELECT * FROM djs ORDER BY dj_id DESC LIMIT 1'
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error creating DJ:', err);
    return sendError(res, 500, 'internal_error', 'Failed to create DJ');
  }
});

/**
 * PUT /djs/:dj_id
 * Update an existing DJ by ID
 */
app.put('/djs/:dj_id', async (req, res) => {
  const djId = parseIdParam(req.params.dj_id);
  if (djId === null) {
    return sendError(res, 400, 'invalid_id', 'Invalid dj_id');
  }

  const schema = z.object({
    dj_name: z.string().min(1),
    instagram: z.string().optional(),
    email: z.string().optional(),
    genres: z.string().optional(),
    soundcloud: z.string().optional(),
    city: z.string().optional(),
    phone: z.string().optional(),
    numeric_fee: z.coerce.number().nonnegative().optional(),
    currency: z.string().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'invalid_body', 'Invalid request body', parsed.error.flatten());
  }

  const {
    dj_name,
    instagram,
    email,
    genres,
    soundcloud,
    city,
    phone,
    numeric_fee,
    currency
  } = parsed.data;

  // Check if the DJ exists
  try {
    const [existing] = await pool.query('SELECT * FROM djs WHERE dj_id = ?', [djId]);
    if (existing.length === 0) {
      return sendError(res, 404, 'not_found', 'DJ not found');
    }

    // Parse numeric fee or fallback to 0
    const feeValue = numeric_fee ? parseFloat(numeric_fee) : 0.0;
    const currencyVal = currency || 'EUR';

    // Update
    await pool.execute(
      `UPDATE djs
         SET dj_name = ?,
             instagram = ?,
             email = ?,
             genres = ?,
             soundcloud = ?,
             city = ?,
             phone = ?,
             numeric_fee = ?,
             currency = ?
       WHERE dj_id = ?`,
      [
        dj_name,
        instagram || '',
        email || '',
        genres || '',
        soundcloud || '',
        city || '',
        phone || '',
        feeValue,
        currencyVal,
        djId
      ]
    );

    // Return the updated record
    const [updated] = await pool.query('SELECT * FROM djs WHERE dj_id = ?', [djId]);
    res.json(updated[0]);
  } catch (err) {
    console.error('Error updating DJ:', err);
    return sendError(res, 500, 'internal_error', 'Failed to update DJ');
  }
});

/**
 * DELETE /djs/:dj_id
 * Delete a DJ record
 */
app.delete('/djs/:dj_id', async (req, res) => {
  const djId = parseIdParam(req.params.dj_id);
  if (djId === null) {
    return sendError(res, 400, 'invalid_id', 'Invalid dj_id');
  }
  try {
    // Check if it exists
    const [existing] = await pool.query('SELECT * FROM djs WHERE dj_id = ?', [djId]);
    if (existing.length === 0) {
      return sendError(res, 404, 'not_found', 'DJ not found');
    }

    await pool.execute('DELETE FROM djs WHERE dj_id = ?', [djId]);
    res.json({ message: 'DJ deleted', dj: existing[0] });
  } catch (err) {
    console.error('Error deleting DJ:', err);
    return sendError(res, 500, 'internal_error', 'Failed to delete DJ');
  }
});

// GET /djs/:dj_id/fee-in-eur
app.get('/djs/:dj_id/fee-in-eur', async (req, res) => {
  const djId = parseIdParam(req.params.dj_id);
  if (djId === null) {
    return sendError(res, 400, 'invalid_id', 'Invalid dj_id');
  }

  try {
    const [rows] = await pool.query('SELECT * FROM djs WHERE dj_id = ?', [djId]);
    if (rows.length === 0) return sendError(res, 404, 'not_found', 'DJ not found');

    const dj = rows[0];

    if ((dj.currency || 'EUR').toUpperCase() === 'EUR') {
      return res.json({
        original_amount: dj.numeric_fee,
        original_currency: dj.currency || 'EUR',
        converted_amount_eur: dj.numeric_fee
      });
    }

    // Try currency conversion
    try {
      console.log('Sending request to CONVERTER_API with payload:', {
        amount: dj.numeric_fee,
        currency: "USD"
      });
      const response = await http.post(CONVERTER_API, {
        amount: parseFloat(dj.numeric_fee),
        currency: dj.currency
      },{
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const { original_amount, original_currency, exchange_rate, converted_amount_eur } = response.data;

      return res.json({
        original_amount,
        original_currency,
        converted_amount_eur
      });
    } catch (conversionError) {
      console.log('Sending request to CONVERTER_API with payload:', {
        amount: dj.numeric_fee,
        currency: dj.currency
      });
      return sendError(res, 502, 'conversion_failed', 'Currency conversion failed');
    }

  } catch (err) {
    console.error('Unexpected error in fee-in-eur endpoint:', err);
    return sendError(res, 500, 'internal_error', 'Internal server error');
  }
});

app.listen(API_PORT, () => {
  console.log(`DJ Service running on port ${API_PORT}`);
});
