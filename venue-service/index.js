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
const SERVICE_NAME = 'venue-service';


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
    console.log(JSON.stringify({
      level: 'info',
      service: SERVICE_NAME,
      request_id: requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration_ms: durationMs,
      timestamp: new Date().toISOString()
    }));
  });
  next();
});

const parseIntOrDefault = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const toMysqlDateTime = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace('T', ' ');
};

if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

const warnOnMissingEnv = () => {
  const missing = [];
  if (!DB_HOST) missing.push('DB_HOST');
  if (!DB_USER) missing.push('DB_USER');
  if (!DB_PASSWORD) missing.push('DB_PASSWORD');
  if (!DB_NAME) missing.push('DB_NAME');
  if (!missing.length) return;
  const message = `[${SERVICE_NAME}] Missing required env: ${missing.join(', ')}`;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(message);
  }
  console.warn(message);
};

warnOnMissingEnv();

// Ensure image_url column exists on venues table
const ensureVenueSchema = async () => {
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'venues' AND COLUMN_NAME = 'image_url'`,
      [DB_NAME]
    );
    if (cols.length === 0) {
      await pool.query('ALTER TABLE venues ADD COLUMN image_url TEXT DEFAULT NULL');
      console.log(`[${SERVICE_NAME}] Added image_url column to venues table`);
    }
  } catch (err) {
    console.warn(`[${SERVICE_NAME}] Schema migration warning:`, err.message);
  }
};
ensureVenueSchema();

const rateLimiter = rateLimit({
  windowMs: parseIntOrDefault(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
  max: parseIntOrDefault(process.env.RATE_LIMIT_MAX, 120),
  standardHeaders: true,
  legacyHeaders: false
});

if (process.env.NODE_ENV !== 'test') {
  app.use(rateLimiter);
}

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

// GET /v1/venues/search => search venues with filters
app.get('/v1/venues/search', async (req, res) => {
  const schema = z.object({
    q: z.string().optional(),
    city: z.string().optional(),
    capacityMin: z.string().optional(),
    capacityMax: z.string().optional(),
    genreFocus: z.string().optional(),
    availableFrom: z.string().optional(),
    availableTo: z.string().optional(),
    limit: z.string().optional(),
    offset: z.string().optional()
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    return sendError(res, 400, 'invalid_query', 'Invalid query parameters', parsed.error.flatten());
  }

  const { q, city, capacityMin, capacityMax, genreFocus, availableFrom, availableTo, limit, offset } = parsed.data;
  const where = [];
  const params = [];

  if (q) {
    const keyword = `%${q.toLowerCase()}%`;
    where.push('(LOWER(name) LIKE ? OR LOWER(address) LIKE ?)');
    params.push(keyword, keyword);
  }

  if (city) {
    where.push('LOWER(address) LIKE ?');
    params.push(`%${city.toLowerCase()}%`);
  }

  if (genreFocus) {
    where.push('LOWER(genreFocus) LIKE ?');
    params.push(`%${genreFocus.toLowerCase()}%`);
  }

  if (capacityMin) {
    const min = Number.parseInt(capacityMin, 10);
    if (!Number.isNaN(min)) {
      where.push('capacity >= ?');
      params.push(min);
    }
  }

  if (capacityMax) {
    const max = Number.parseInt(capacityMax, 10);
    if (!Number.isNaN(max)) {
      where.push('capacity <= ?');
      params.push(max);
    }
  }

  const fromDate = toMysqlDateTime(availableFrom);
  const toDate = toMysqlDateTime(availableTo);
  if (fromDate && toDate) {
    where.push(
      `EXISTS (
        SELECT 1 FROM venue_availability va
        WHERE va.venue_id = venues.id
          AND va.start_time <= ?
          AND va.end_time >= ?
      )`
    );
    params.push(toDate, fromDate);
  }

  const parsedLimit = Number.parseInt(limit || '100', 10);
  const limitValue = Number.isNaN(parsedLimit) ? 100 : Math.min(parsedLimit, 500);
  const parsedOffset = Number.parseInt(offset || '0', 10);
  const offsetValue = Number.isNaN(parsedOffset) ? 0 : Math.max(parsedOffset, 0);

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  try {
    const [rows] = await pool.query(
      `SELECT * FROM venues ${whereSql} ORDER BY name ASC LIMIT ? OFFSET ?`,
      [...params, limitValue, offsetValue]
    );
    res.json({ venues: rows, count: rows.length });
  } catch (err) {
    console.error('Error searching venues:', err);
    return sendError(res, 500, 'internal_error', 'Failed to search venues');
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

// GET /v1/venues/:id/availability => list availability windows
app.get('/v1/venues/:id/availability', async (req, res) => {
  const venueId = parseIdParam(req.params.id);
  if (venueId === null) {
    return sendError(res, 400, 'invalid_id', 'Invalid venue id');
  }
  try {
    const [rows] = await pool.query(
      'SELECT * FROM venue_availability WHERE venue_id = ? ORDER BY start_time ASC',
      [venueId]
    );
    return res.json({ venue_id: venueId, availability: rows });
  } catch (err) {
    console.error('Error fetching availability:', err);
    return sendError(res, 500, 'internal_error', 'Failed to fetch availability');
  }
});

// POST /v1/venues/:id/availability => add availability window
app.post('/v1/venues/:id/availability', async (req, res) => {
  const venueId = parseIdParam(req.params.id);
  if (venueId === null) {
    return sendError(res, 400, 'invalid_id', 'Invalid venue id');
  }
  const schema = z.object({
    start_time: z.string(),
    end_time: z.string(),
    status: z.string().optional(),
    notes: z.string().optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'invalid_body', 'Invalid request body', parsed.error.flatten());
  }
  const startTime = toMysqlDateTime(parsed.data.start_time);
  const endTime = toMysqlDateTime(parsed.data.end_time);
  if (!startTime || !endTime) {
    return sendError(res, 400, 'invalid_body', 'Invalid date range');
  }
  try {
    const [existing] = await pool.query('SELECT id FROM venues WHERE id = ?', [venueId]);
    if (existing.length === 0) {
      return sendError(res, 404, 'not_found', 'Venue not found');
    }
    const [result] = await pool.execute(
      `INSERT INTO venue_availability
        (venue_id, start_time, end_time, status, notes)
       VALUES (?, ?, ?, ?, ?)`,
      [venueId, startTime, endTime, parsed.data.status || 'available', parsed.data.notes || null]
    );
    const [rows] = await pool.query('SELECT * FROM venue_availability WHERE id = ?', [result.insertId]);
    return res.status(201).json({ availability: rows[0] });
  } catch (err) {
    console.error('Error creating availability:', err);
    return sendError(res, 500, 'internal_error', 'Failed to create availability');
  }
});

// DELETE /v1/venues/:id/availability/:availability_id => remove availability window
app.delete('/v1/venues/:id/availability/:availability_id', async (req, res) => {
  const venueId = parseIdParam(req.params.id);
  const availabilityId = parseIdParam(req.params.availability_id);
  if (venueId === null || availabilityId === null) {
    return sendError(res, 400, 'invalid_id', 'Invalid id');
  }
  try {
    const [existing] = await pool.query(
      'SELECT * FROM venue_availability WHERE id = ? AND venue_id = ?',
      [availabilityId, venueId]
    );
    if (existing.length === 0) {
      return sendError(res, 404, 'not_found', 'Availability not found');
    }
    await pool.execute('DELETE FROM venue_availability WHERE id = ?', [availabilityId]);
    return res.json({ deleted: true });
  } catch (err) {
    console.error('Error deleting availability:', err);
    return sendError(res, 500, 'internal_error', 'Failed to delete availability');
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
    notes: z.string().optional(),
    image_url: z.string().url().optional().nullable()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'invalid_body', 'Invalid request body', parsed.error.flatten());
  }
  const { id, name, address, capacity, genreFocus, latitude, longitude, notes, image_url } = parsed.data;

  try {
    await pool.query(
      `INSERT INTO venues
        (id, name, address, capacity, genreFocus, latitude, longitude, notes, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        address,
        capacity || 100,
        genreFocus || 'Various',
        latitude || 53.0,
        longitude || -6.0,
        notes || '',
        image_url || null,
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
    notes: z.string().optional(),
    image_url: z.string().url().optional().nullable()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'invalid_body', 'Invalid request body', parsed.error.flatten());
  }
  const { name, address, capacity, genreFocus, latitude, longitude, notes, image_url } = parsed.data;

  try {
    // Check if the venue exists
    const [existing] = await pool.query('SELECT * FROM venues WHERE id = ?', [venueId]);
    if (existing.length === 0) {
      return sendError(res, 404, 'not_found', 'Venue not found');
    }

    await pool.query(
      `UPDATE venues
         SET name = ?, address = ?, capacity = ?, genreFocus = ?, latitude = ?, longitude = ?, notes = ?, image_url = ?
       WHERE id = ?`,
      [
        name,
        address,
        capacity || 100,
        genreFocus || 'Various',
        latitude || 53.0,
        longitude || -6.0,
        notes || '',
        image_url !== undefined ? image_url : existing[0].image_url,
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
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`${SERVICE_NAME} listening on port ${PORT}`);
  });
}

module.exports = { app, pool };
