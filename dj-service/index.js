const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const axios = require('axios'); 
// Load env vars or define defaults
const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = process.env.DB_PORT || '3306';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || 'UTav@2523';
const DB_NAME = process.env.DB_NAME || 'gigsdb';
const API_PORT = process.env.API_PORT || 4002;

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
const router = express.Router();
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  
const CONVERTER_API = 'https://5ss3rebhtf.execute-api.us-east-1.amazonaws.com/currencyConverter';
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
  const djId = parseInt(req.params.dj_id, 10);
  try {
    const [rows] = await pool.query('SELECT * FROM djs WHERE dj_id = ?', [djId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'DJ not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Error retrieving DJ:', err);
    res.status(500).json({ error: 'Failed to retrieve DJ' });
  }
});

/**
 * POST /djs
 * Create a new DJ record
 */
app.post('/djs', async (req, res) => {
  // Extract fields from request body
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
  } = req.body;

  // 'dj_name' is required
  if (!dj_name) {
    return res.status(400).json({ error: 'Missing required field: dj_name' });
  }

  // Convert numeric_fee to float or default to 0
  const feeValue = numeric_fee ? parseFloat(numeric_fee) : 0.0;
  const currencyVal = currency || 'EUR';

  try {
    // Insert into 'djs' table
    await pool.execute(
      `INSERT INTO djs
        (dj_name, instagram, email, genres, soundcloud, city, phone, numeric_fee, currency)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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
    res.status(500).json({ error: 'Failed to create DJ' });
  }
});

/**
 * PUT /djs/:dj_id
 * Update an existing DJ by ID
 */
app.put('/djs/:dj_id', async (req, res) => {
  const djId = parseInt(req.params.dj_id, 10);

  // Extract fields from request body
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
  } = req.body;

  // 'dj_name' is still required for updates
  if (!dj_name) {
    return res.status(400).json({ error: 'Missing required field: dj_name' });
  }

  // Check if the DJ exists
  try {
    const [existing] = await pool.query('SELECT * FROM djs WHERE dj_id = ?', [djId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'DJ not found' });
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
    res.status(500).json({ error: 'Failed to update DJ' });
  }
});

/**
 * DELETE /djs/:dj_id
 * Delete a DJ record
 */
app.delete('/djs/:dj_id', async (req, res) => {
  const djId = parseInt(req.params.dj_id, 10);
  try {
    // Check if it exists
    const [existing] = await pool.query('SELECT * FROM djs WHERE dj_id = ?', [djId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'DJ not found' });
    }

    await pool.execute('DELETE FROM djs WHERE dj_id = ?', [djId]);
    res.json({ message: 'DJ deleted', dj: existing[0] });
  } catch (err) {
    console.error('Error deleting DJ:', err);
    res.status(500).json({ error: 'Failed to delete DJ' });
  }
});

// GET /djs/:dj_id/fee-in-eur
app.get('/djs/:dj_id/fee-in-eur', async (req, res) => {
  const djId = parseInt(req.params.dj_id, 10);

  try {
    const [rows] = await pool.query('SELECT * FROM djs WHERE dj_id = ?', [djId]);
    if (rows.length === 0) return res.status(404).json({ error: 'DJ not found' });

    const dj = rows[0];

    if (dj.currency.toUpperCase() === 'EUR') {
      return res.json({
        original_amount: dj.numeric_fee,
        original_currency: dj.currency,
        converted_amount_eur: dj.numeric_fee
      });
    }

    // Try currency conversion
    try {
      const response = await axios.post(CONVERTER_API, {
        amount: dj.numeric_fee,
        currency: dj.currency
      });

      const { original_amount, original_currency, exchange_rate, converted_amount_eur } = response.data;

      return res.json({
        original_amount,
        original_currency,
        exchange_rate,
        converted_amount_eur
      });
    } catch (conversionError) {
      console.error(`Currency conversion failed: ${conversionError.message}`);
      return res.status(502).json({
        error: 'Currency conversion failed',
        details: 'The converter service may be down or does not support this currency.'
      });
    }

  } catch (err) {
    console.error('Unexpected error in fee-in-eur endpoint:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.use('/dj-service', router);
app.listen(API_PORT, () => {
  console.log(`DJ Service running on port ${API_PORT}`);
});
