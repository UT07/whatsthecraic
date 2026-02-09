// local-events-service/index.js

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const { z } = require('zod');
const jwt = require('jsonwebtoken');
const { ingestTicketmaster, ingestEventbrite, upsertEvent, upsertSourceEvent } = require('./ingestion');

// Adjust these env vars / defaults as needed
const DB_HOST = process.env.DB_HOST || 'db';
const DB_PORT = process.env.DB_PORT || '3306';
const DB_USER = process.env.DB_USER || 'app';
const DB_PASSWORD = process.env.DB_PASSWORD || 'app';
const DB_NAME = process.env.DB_NAME || 'gigsdb';
const API_PORT = process.env.API_PORT || process.env.EVENTS_SERVICE_PORT || 4003;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

const INGESTION_ENABLED = (process.env.INGESTION_ENABLED || 'false') === 'true';
const INGESTION_STALE_HOURS = Number.parseInt(process.env.INGESTION_STALE_HOURS || '6', 10);
const INGESTION_DEFAULT_CITY = process.env.INGESTION_DEFAULT_CITY || 'Dublin';
const INGESTION_MAX_PAGES = Number.parseInt(process.env.INGESTION_MAX_PAGES || '5', 10);
const TICKETMASTER_API_KEY = process.env.TICKETMASTER_API_KEY || null;
const EVENTBRITE_API_TOKEN = process.env.EVENTBRITE_API_TOKEN || null;

const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

const app = express();
app.use(cors());
app.use(express.json());
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

const parseDateParam = (value, fallback) => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date;
};

const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return sendError(res, 401, 'unauthorized', 'Missing bearer token');
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch (err) {
    return sendError(res, 401, 'unauthorized', 'Invalid token');
  }
};

const inflightIngestion = new Set();

const triggerIngestion = async (source, city, startDate, endDate) => {
  const key = `${source}:${city}`;
  if (inflightIngestion.has(key)) return;
  inflightIngestion.add(key);
  try {
    if (source === 'ticketmaster') {
      await ingestTicketmaster(pool, {
        city,
        startDate,
        endDate,
        apiKey: TICKETMASTER_API_KEY,
        maxPages: INGESTION_MAX_PAGES
      });
    }
    if (source === 'eventbrite') {
      await ingestEventbrite(pool, {
        city,
        startDate,
        endDate,
        token: EVENTBRITE_API_TOKEN,
        maxPages: INGESTION_MAX_PAGES
      });
    }
  } catch (err) {
    console.warn(`Ingestion failed for ${source}/${city}:`, err.message);
  } finally {
    inflightIngestion.delete(key);
  }
};

const maybeTriggerIngestion = async (city, startDate, endDate) => {
  if (!INGESTION_ENABLED) return;
  const [rows] = await pool.query(
    'SELECT source, last_synced_at FROM ingest_state WHERE city = ?',
    [city]
  );
  const lastSynced = new Map(rows.map(row => [row.source, new Date(row.last_synced_at)]));
  const staleThreshold = Date.now() - (INGESTION_STALE_HOURS * 60 * 60 * 1000);
  const sources = ['ticketmaster', 'eventbrite'];
  sources.forEach((source) => {
    const last = lastSynced.get(source);
    if (!last || last.getTime() < staleThreshold) {
      setImmediate(() => triggerIngestion(source, city, startDate, endDate));
    }
  });
};

const syncLocalEventsToCanonical = async () => {
  const [rows] = await pool.query(
    `SELECT le.*
     FROM local_events le
     LEFT JOIN source_events se
       ON se.source = 'local' AND se.source_id = CAST(le.id AS CHAR)
     WHERE se.id IS NULL`
  );
  for (const ev of rows) {
    if (!ev.event_name || !ev.date_local) continue;
    const start = ev.time_local
      ? `${ev.date_local}T${ev.time_local}`
      : `${ev.date_local}T00:00:00`;
    const startDate = new Date(start);
    if (Number.isNaN(startDate.getTime())) continue;
    const eventRecord = {
      title: ev.event_name,
      description: null,
      start_time: startDate.toISOString().slice(0, 19).replace('T', ' '),
      end_time: null,
      city: ev.city || 'Dublin',
      latitude: null,
      longitude: null,
      venue_name: ev.venue_name || null,
      ticket_url: ev.url || null,
      age_restriction: null,
      price_min: null,
      price_max: null,
      currency: null,
      genres: ev.classification_name ? [ev.classification_name.toLowerCase()] : [],
      tags: ['local'],
      images: []
    };

    const eventId = await upsertEvent(pool, eventRecord);
    await upsertSourceEvent(pool, {
      source: 'local',
      source_id: String(ev.id),
      event_id: eventId,
      raw_payload: ev
    });
  }
};

/**
 * GET /events
 * Fetch all local events
 */
app.get('/events', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM local_events');
    res.json(rows);
  } catch (err) {
    console.error('Error fetching local events:', err);
    res.status(500).json({ error: 'Failed to fetch local events' });
  }
});

/**
 * GET /events/:id
 * Fetch one event by ID
 */
app.get('/events/:id', async (req, res) => {
  const eventId = parseIdParam(req.params.id);
  if (eventId === null) {
    return sendError(res, 400, 'invalid_id', 'Invalid event id');
  }
  try {
    const [rows] = await pool.query('SELECT * FROM local_events WHERE id = ?', [eventId]);
    if (rows.length === 0) {
      return sendError(res, 404, 'not_found', 'Event not found');
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Error retrieving event:', err);
    return sendError(res, 500, 'internal_error', 'Failed to retrieve event');
  }
});

/**
 * POST /events
 * Create a new local event
 * Body fields: event_name, classification_name, city, date_local, time_local, venue_name, url
 */
app.post('/events', async (req, res) => {
  const schema = z.object({
    event_name: z.string().min(1),
    classification_name: z.string().optional(),
    city: z.string().optional(),
    date_local: z.string().optional().nullable(),
    time_local: z.string().optional().nullable(),
    venue_name: z.string().optional().nullable(),
    url: z.string().url().optional().nullable()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'invalid_body', 'Invalid request body', parsed.error.flatten());
  }
  const {
    event_name,
    classification_name,
    city,
    date_local,
    time_local,
    venue_name,
    url
  } = parsed.data;

  try {
    const insertSQL = `
      INSERT INTO local_events
        (event_name, classification_name, city, date_local, time_local, venue_name, url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    await pool.execute(insertSQL, [
      event_name,
      classification_name || 'Music',
      city || 'Dublin',
      date_local || null,
      time_local || null,
      venue_name || null,
      url || null
    ]);

    // Return the newly created record (the last inserted row)
    const [latest] = await pool.query('SELECT * FROM local_events ORDER BY id DESC LIMIT 1');
    res.status(201).json(latest[0]);
  } catch (err) {
    console.error('Error creating local event:', err);
    return sendError(res, 500, 'internal_error', 'Failed to create local event');
  }
});

/**
 * PUT /events/:id
 * Update an existing local event by ID
 */
app.put('/events/:id', async (req, res) => {
  const eventId = parseIdParam(req.params.id);
  if (eventId === null) {
    return sendError(res, 400, 'invalid_id', 'Invalid event id');
  }
  const schema = z.object({
    event_name: z.string().min(1),
    classification_name: z.string().optional(),
    city: z.string().optional(),
    date_local: z.string().optional().nullable(),
    time_local: z.string().optional().nullable(),
    venue_name: z.string().optional().nullable(),
    url: z.string().url().optional().nullable()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'invalid_body', 'Invalid request body', parsed.error.flatten());
  }
  const {
    event_name,
    classification_name,
    city,
    date_local,
    time_local,
    venue_name,
    url
  } = parsed.data;

  try {
    // Check if the event exists
    const [existing] = await pool.query('SELECT * FROM local_events WHERE id = ?', [eventId]);
    if (existing.length === 0) {
      return sendError(res, 404, 'not_found', 'Event not found');
    }

    const updateSQL = `
      UPDATE local_events
         SET event_name = ?,
             classification_name = ?,
             city = ?,
             date_local = ?,
             time_local = ?,
             venue_name = ?,
             url = ?
       WHERE id = ?
    `;
    await pool.execute(updateSQL, [
      event_name,
      classification_name || 'Music',
      city || 'Dublin',
      date_local || null,
      time_local || null,
      venue_name || null,
      url || null,
      eventId
    ]);

    const [updated] = await pool.query('SELECT * FROM local_events WHERE id = ?', [eventId]);
    res.json(updated[0]);
  } catch (err) {
    console.error('Error updating local event:', err);
    return sendError(res, 500, 'internal_error', 'Failed to update local event');
  }
});

/**
 * DELETE /events/:id
 * Delete a local event by ID
 */
app.delete('/events/:id', async (req, res) => {
  const eventId = parseIdParam(req.params.id);
  if (eventId === null) {
    return sendError(res, 400, 'invalid_id', 'Invalid event id');
  }
  try {
    const [existing] = await pool.query('SELECT * FROM local_events WHERE id = ?', [eventId]);
    if (existing.length === 0) {
      return sendError(res, 404, 'not_found', 'Event not found');
    }

    await pool.execute('DELETE FROM local_events WHERE id = ?', [eventId]);
    res.json({ message: 'Event deleted', event: existing[0] });
  } catch (err) {
    console.error('Error deleting local event:', err);
    return sendError(res, 500, 'internal_error', 'Failed to delete local event');
  }
});

const buildEventResponse = (row, sources = []) => {
  const parseJson = (value, fallback = []) => {
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  };
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    start_time: row.start_time ? new Date(row.start_time).toISOString() : null,
    end_time: row.end_time ? new Date(row.end_time).toISOString() : null,
    city: row.city,
    geo: {
      lat: row.latitude,
      lon: row.longitude
    },
    venue_name: row.venue_name,
    ticket_url: row.ticket_url,
    age_restriction: row.age_restriction,
    price: {
      min: row.price_min,
      max: row.price_max,
      currency: row.currency
    },
    genres: parseJson(row.genres),
    tags: parseJson(row.tags),
    images: parseJson(row.images),
    sources
  };
};

app.get('/v1/events/search', async (req, res) => {
  const schema = z.object({
    city: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    genres: z.string().optional(),
    priceMax: z.string().optional(),
    source: z.enum(['eventbrite', 'ticketmaster', 'local']).optional(),
    limit: z.string().optional(),
    offset: z.string().optional()
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    return sendError(res, 400, 'invalid_query', 'Invalid query parameters', parsed.error.flatten());
  }

  const {
    city,
    from,
    to,
    genres,
    priceMax,
    source,
    limit,
    offset
  } = parsed.data;

  const fromDate = parseDateParam(from, new Date());
  const toDate = parseDateParam(to, new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));

  await syncLocalEventsToCanonical();
  await maybeTriggerIngestion(city || INGESTION_DEFAULT_CITY, fromDate, toDate);

  const where = [];
  const params = [];

  where.push('start_time >= ?');
  params.push(fromDate.toISOString().slice(0, 19).replace('T', ' '));
  where.push('start_time <= ?');
  params.push(toDate.toISOString().slice(0, 19).replace('T', ' '));

  if (city) {
    where.push('LOWER(city) = LOWER(?)');
    params.push(city);
  }

  if (priceMax) {
    const max = Number.parseFloat(priceMax);
    if (!Number.isNaN(max)) {
      where.push('(price_min IS NULL OR price_min <= ?)');
      params.push(max);
    }
  }

  if (genres) {
    const list = genres.split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
    list.forEach((genre) => {
      where.push(\"JSON_SEARCH(genres, 'one', ?) IS NOT NULL\");
      params.push(genre);
    });
  }

  if (source) {
    where.push('EXISTS (SELECT 1 FROM source_events se WHERE se.event_id = events.id AND se.source = ?)');
    params.push(source);
  }

  const parsedLimit = Number.parseInt(limit || '50', 10);
  const limitValue = Number.isNaN(parsedLimit) ? 50 : Math.min(parsedLimit, 200);
  const parsedOffset = Number.parseInt(offset || '0', 10);
  const offsetValue = Number.isNaN(parsedOffset) ? 0 : Math.max(parsedOffset, 0);

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [rows] = await pool.query(
    `SELECT * FROM events ${whereSql} ORDER BY start_time ASC LIMIT ? OFFSET ?`,
    [...params, limitValue, offsetValue]
  );

  const eventIds = rows.map(row => row.id);
  let sourcesByEvent = new Map();
  if (eventIds.length > 0) {
    const [sourceRows] = await pool.query(
      `SELECT event_id, source, source_id FROM source_events WHERE event_id IN (${eventIds.map(() => '?').join(',')})`,
      eventIds
    );
    sourcesByEvent = sourceRows.reduce((acc, row) => {
      const entry = acc.get(row.event_id) || [];
      entry.push({ source: row.source, source_id: row.source_id });
      acc.set(row.event_id, entry);
      return acc;
    }, new Map());
  }

  const events = rows.map(row => buildEventResponse(row, sourcesByEvent.get(row.id) || []));
  return res.json({ events, count: events.length });
});

app.get('/v1/events/:id', async (req, res) => {
  const eventId = parseIdParam(req.params.id);
  if (eventId === null) {
    return sendError(res, 400, 'invalid_id', 'Invalid event id');
  }
  const [rows] = await pool.query('SELECT * FROM events WHERE id = ?', [eventId]);
  if (rows.length === 0) {
    return sendError(res, 404, 'not_found', 'Event not found');
  }
  const [sourceRows] = await pool.query('SELECT source, source_id FROM source_events WHERE event_id = ?', [eventId]);
  return res.json(buildEventResponse(rows[0], sourceRows));
});

app.post('/v1/events/:id/save', requireAuth, async (req, res) => {
  const eventId = parseIdParam(req.params.id);
  if (eventId === null) {
    return sendError(res, 400, 'invalid_id', 'Invalid event id');
  }
  const userId = req.user?.user_id;
  if (!userId) {
    return sendError(res, 401, 'unauthorized', 'Invalid user token');
  }
  const [rows] = await pool.query('SELECT id FROM events WHERE id = ?', [eventId]);
  if (rows.length === 0) {
    return sendError(res, 404, 'not_found', 'Event not found');
  }
  await pool.execute(
    `INSERT INTO user_saved_events (user_id, event_id)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE saved_at = CURRENT_TIMESTAMP`,
    [userId, eventId]
  );
  return res.status(200).json({ saved: true, event_id: eventId });
});

if (INGESTION_ENABLED) {
  const runScheduledIngestion = async () => {
    const now = new Date();
    const start = new Date(now.getTime());
    const end = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    await triggerIngestion('ticketmaster', INGESTION_DEFAULT_CITY, start, end);
    await triggerIngestion('eventbrite', INGESTION_DEFAULT_CITY, start, end);
  };
  runScheduledIngestion();
  setInterval(runScheduledIngestion, INGESTION_STALE_HOURS * 60 * 60 * 1000);
}

app.listen(API_PORT, () => {
  console.log(`Local Events Service running on port ${API_PORT}`);
});
