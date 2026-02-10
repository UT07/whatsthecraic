// venue-service/index.js

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');


const DB_HOST = process.env.DB_HOST || 'db';
const DB_PORT = process.env.DB_PORT || '3306';
const DB_USER = process.env.DB_USER || 'app';
const DB_PASSWORD = process.env.DB_PASSWORD || 'app';
const DB_NAME = process.env.DB_NAME || 'gigsdb';
const API_PORT = process.env.API_PORT || process.env.VENUE_SERVICE_PORT || 4001;


const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const app = express();
app.use(express.json());
app.use(cors());

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

const metrics = {
  startTime: Date.now(),
  requests: 0,
  statusCodes: {},
  totalDurationMs: 0
};

app.use((req, res, next) => {
  const requestId = crypto.randomUUID();
  req.requestId = requestId;
  res.set('X-Request-Id', requestId);
  const started = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - started;
    metrics.requests += 1;
    metrics.totalDurationMs += durationMs;
    metrics.statusCodes[res.statusCode] = (metrics.statusCodes[res.statusCode] || 0) + 1;
    console.log(`[${requestId}] ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms`);
  });
  next();
});

const parseIntOrDefault = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

const rateLimiter = rateLimit({
  windowMs: parseIntOrDefault(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
  max: parseIntOrDefault(process.env.RATE_LIMIT_MAX, 120),
  standardHeaders: true,
  legacyHeaders: false
});

app.use(rateLimiter);

app.get('/metrics', (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - metrics.startTime) / 1000);
  const avgDuration = metrics.requests > 0
    ? Number((metrics.totalDurationMs / metrics.requests).toFixed(2))
    : 0;
  res.json({
    uptime_seconds: uptimeSeconds,
    requests_total: metrics.requests,
    status_codes: metrics.statusCodes,
    avg_duration_ms: avgDuration
  });
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

// GET /venues => SELECT * FROM venues
app.get('/venues', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM venues');
    res.json(rows);
  } catch (err) {
    console.error('Error fetching venues:', err);
    return sendError(res, 500, 'internal_error', 'Failed to fetch venues');
  }
});

// GET /venues/:id => SELECT * FROM venues WHERE id=?
app.get('/venues/:id', async (req, res) => {
  const venueId = parseIdParam(req.params.id);
  if (venueId === null) {
    return sendError(res, 400, 'invalid_id', 'Invalid venue id');
  }
  try {
    const [rows] = await pool.query('SELECT * FROM venues WHERE id = ?', [venueId]);
    if (rows.length === 0) {
      return sendError(res, 404, 'not_found', 'Venue not found');
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Error retrieving venue:', err);
    return sendError(res, 500, 'internal_error', 'Failed to retrieve venue');
  }
});

// POST /venues => INSERT a new venue
app.post('/venues', async (req, res) => {
  const schema = z.object({
    id: z.coerce.number().int().positive(),
    name: z.string().min(1),
    address: z.string().min(1),
    capacity: z.coerce.number().int().positive().optional(),
    genreFocus: z.string().optional(),
    latitude: z.coerce.number().optional(),
    longitude: z.coerce.number().optional(),
    notes: z.string().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'invalid_body', 'Invalid request body', parsed.error.flatten());
  }
  const { id, name, address, capacity, genreFocus, latitude, longitude, notes } = parsed.data;

  try {
    await pool.query(
      `INSERT INTO venues
        (id, name, address, capacity, genreFocus, latitude, longitude, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        address,
        capacity || 100,
        genreFocus || 'Various',
        latitude || 53.0,
        longitude || -6.0,
        notes || '',
      ]
    );

    // Return the newly created record
    const [rows] = await pool.query('SELECT * FROM venues WHERE id = ?', [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error creating venue:', err);
    return sendError(res, 500, 'internal_error', 'Failed to create venue');
  }
});

// PUT /venues/:id => UPDATE an existing venue
app.put('/venues/:id', async (req, res) => {
  const venueId = parseIdParam(req.params.id);
  if (venueId === null) {
    return sendError(res, 400, 'invalid_id', 'Invalid venue id');
  }
  const schema = z.object({
    name: z.string().min(1),
    address: z.string().min(1),
    capacity: z.coerce.number().int().positive().optional(),
    genreFocus: z.string().optional(),
    latitude: z.coerce.number().optional(),
    longitude: z.coerce.number().optional(),
    notes: z.string().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'invalid_body', 'Invalid request body', parsed.error.flatten());
  }
  const { name, address, capacity, genreFocus, latitude, longitude, notes } = parsed.data;

  try {
    // Check if the venue exists
    const [existing] = await pool.query('SELECT * FROM venues WHERE id = ?', [venueId]);
    if (existing.length === 0) {
      return sendError(res, 404, 'not_found', 'Venue not found');
    }

    await pool.query(
      `UPDATE venues
         SET name = ?, address = ?, capacity = ?, genreFocus = ?, latitude = ?, longitude = ?, notes = ?
       WHERE id = ?`,
      [
        name,
        address,
        capacity || 100,
        genreFocus || 'Various',
        latitude || 53.0,
        longitude || -6.0,
        notes || '',
        venueId
      ]
    );

    // Return the updated record
    const [updated] = await pool.query('SELECT * FROM venues WHERE id = ?', [venueId]);
    res.json(updated[0]);
  } catch (err) {
    console.error('Error updating venue:', err);
    return sendError(res, 500, 'internal_error', 'Failed to update venue');
  }
});

// DELETE /venues/:id => remove a venue by ID
app.delete('/venues/:id', async (req, res) => {
  const venueId = parseIdParam(req.params.id);
  if (venueId === null) {
    return sendError(res, 400, 'invalid_id', 'Invalid venue id');
  }

  try {
    // Check if it exists
    const [existing] = await pool.query('SELECT * FROM venues WHERE id = ?', [venueId]);
    if (existing.length === 0) {
      return sendError(res, 404, 'not_found', 'Venue not found');
    }

    await pool.query('DELETE FROM venues WHERE id = ?', [venueId]);
    res.json({ message: 'Venue deleted', venue: existing[0] });
  } catch (err) {
    console.error('Error deleting venue:', err);
    return sendError(res, 500, 'internal_error', 'Failed to delete venue');
  }
});

// 4. Start the server
const PORT = process.env.PORT || API_PORT || 4001;
app.listen(PORT, () => {
  console.log(`Venue Service listening on port ${PORT}`);
});
