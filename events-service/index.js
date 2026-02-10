// local-events-service/index.js

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const { z } = require('zod');
const jwt = require('jsonwebtoken');
const { ingestTicketmaster, ingestEventbrite, ingestXraves, upsertEvent, upsertSourceEvent } = require('./ingestion');
const rateLimit = require('express-rate-limit');

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
const TICKETMASTER_COUNTRY_CODE = process.env.TICKETMASTER_COUNTRY_CODE || null;
const EVENTBRITE_API_TOKEN = process.env.EVENTBRITE_API_TOKEN || null;
const EVENTBRITE_ORG_IDS = process.env.EVENTBRITE_ORG_IDS
  ? process.env.EVENTBRITE_ORG_IDS.split(',').map(id => id.trim()).filter(Boolean)
  : null;
const XRAVES_ENABLED = (process.env.XRAVES_ENABLED || 'false') === 'true';
const XRAVES_BASE_URL = process.env.XRAVES_BASE_URL || 'https://xraves.ie/';
const XRAVES_USER_AGENT = process.env.XRAVES_USER_AGENT || 'WhatsTheCraicIngestionBot/1.0';

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

const parseDateParam = (value, fallback) => {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date;
};

const toMysqlDateTime = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace('T', ' ');
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

const requireOrganizer = (req, res, next) => {
  const role = req.user?.role;
  if (role === 'organizer' || role === 'admin') {
    return next();
  }
  return sendError(res, 403, 'forbidden', 'Organizer role required');
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
        countryCode: TICKETMASTER_COUNTRY_CODE,
        maxPages: INGESTION_MAX_PAGES
      });
    }
    if (source === 'eventbrite') {
      await ingestEventbrite(pool, {
        city,
        startDate,
        endDate,
        token: EVENTBRITE_API_TOKEN,
        orgIds: EVENTBRITE_ORG_IDS,
        maxPages: INGESTION_MAX_PAGES
      });
    }
    if (source === 'xraves') {
      await ingestXraves(pool, {
        city,
        startDate,
        endDate,
        baseUrl: XRAVES_BASE_URL,
        userAgent: XRAVES_USER_AGENT,
        enabled: XRAVES_ENABLED
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
  const sources = ['ticketmaster', 'eventbrite', 'xraves'];
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
       ON se.source = 'local' AND se.source_id = CAST(le.id AS CHAR) COLLATE utf8mb4_0900_ai_ci
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
    return sendError(res, 500, 'internal_error', 'Failed to fetch local events');
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

const parseJson = (value, fallback = []) => {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normalizeToken = (value) => (value ?? '').toString().toLowerCase().trim();

const normalizeTokenList = (value) => {
  if (Array.isArray(value)) {
    return value.map(normalizeToken).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[/,|]+/)
      .map(normalizeToken)
      .filter(Boolean);
  }
  return [];
};

const buildEventResponse = (row, sources = []) => {
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

const getUserSignals = async (userId) => {
  const [prefRows] = await pool.query(
    `SELECT preferred_genres, preferred_artists, preferred_cities, preferred_venues,
            preferred_djs, budget_max, radius_km, night_preferences
     FROM user_preferences WHERE user_id = ?`,
    [userId]
  );
  const [spotifyRows] = await pool.query(
    'SELECT top_genres, top_artists FROM user_spotify WHERE user_id = ?',
    [userId]
  );

  const prefRow = prefRows.length ? prefRows[0] : {};
  const preferredGenres = parseJson(prefRow.preferred_genres);
  const preferredArtists = parseJson(prefRow.preferred_artists);
  const preferredCities = parseJson(prefRow.preferred_cities);
  const preferredVenues = parseJson(prefRow.preferred_venues);
  const preferredDjs = parseJson(prefRow.preferred_djs);
  const budgetMax = prefRow.budget_max === null || prefRow.budget_max === undefined
    ? null
    : Number(prefRow.budget_max);
  const radiusKm = prefRow.radius_km === null || prefRow.radius_km === undefined
    ? null
    : Number(prefRow.radius_km);
  const nightPreferences = parseJson(prefRow.night_preferences);
  const spotifyGenresRaw = spotifyRows.length ? parseJson(spotifyRows[0].top_genres) : [];
  const spotifyArtistsRaw = spotifyRows.length ? parseJson(spotifyRows[0].top_artists) : [];
  const spotifyGenres = Array.isArray(spotifyGenresRaw)
    ? spotifyGenresRaw.map(item => normalizeToken(item.genre || item)).filter(Boolean)
    : [];
  const spotifyArtists = Array.isArray(spotifyArtistsRaw)
    ? spotifyArtistsRaw
      .map(item => normalizeToken(item.name || item))
      .filter(Boolean)
    : [];

  return {
    preferredGenres: preferredGenres.map(normalizeToken).filter(Boolean),
    preferredArtists: preferredArtists.map(normalizeToken).filter(Boolean),
    preferredCities: preferredCities.map(normalizeToken).filter(Boolean),
    preferredVenues: preferredVenues.map(normalizeToken).filter(Boolean),
    preferredDjs: preferredDjs.map(normalizeToken).filter(Boolean),
    budgetMax,
    radiusKm,
    nightPreferences: nightPreferences.map(normalizeToken).filter(Boolean),
    spotifyGenres,
    spotifyArtists
  };
};

const scoreEventRow = (row, signals) => {
  const reasons = [];
  let score = 0;

  const genres = parseJson(row.genres).map(normalizeToken).filter(Boolean);
  const title = normalizeToken(row.title);
  const description = normalizeToken(row.description);

  const genreMatches = genres.filter(g => signals.preferredGenres.includes(g));
  if (genreMatches.length > 0) {
    score += genreMatches.length * 3;
    reasons.push({ type: 'preferred_genre', values: genreMatches.slice(0, 3) });
  }

  const spotifyGenreMatches = genres.filter(g => signals.spotifyGenres.includes(g));
  if (spotifyGenreMatches.length > 0) {
    score += spotifyGenreMatches.length * 2;
    reasons.push({ type: 'spotify_genre', values: spotifyGenreMatches.slice(0, 3) });
  }

  const artistMatches = signals.preferredArtists.filter(artist =>
    artist && (title.includes(artist) || description.includes(artist))
  );
  if (artistMatches.length > 0) {
    score += artistMatches.length * 5;
    reasons.push({ type: 'preferred_artist', values: artistMatches.slice(0, 3) });
  }

  const spotifyArtistMatches = signals.spotifyArtists.filter(artist =>
    artist && (title.includes(artist) || description.includes(artist))
  );
  if (spotifyArtistMatches.length > 0) {
    score += spotifyArtistMatches.length * 4;
    reasons.push({ type: 'spotify_artist', values: spotifyArtistMatches.slice(0, 3) });
  }

  const venueName = normalizeToken(row.venue_name);
  const venueMatches = signals.preferredVenues.filter(venue =>
    venue && venueName.includes(venue)
  );
  if (venueMatches.length > 0) {
    score += venueMatches.length * 4;
    reasons.push({ type: 'preferred_venue', values: venueMatches.slice(0, 3) });
  }

  const djMatches = signals.preferredDjs.filter(dj =>
    dj && (title.includes(dj) || description.includes(dj))
  );
  if (djMatches.length > 0) {
    score += djMatches.length * 4;
    reasons.push({ type: 'preferred_dj', values: djMatches.slice(0, 3) });
  }

  if (signals.preferredCities.length > 0 && row.city) {
    const cityMatch = signals.preferredCities.includes(normalizeToken(row.city));
    if (cityMatch) {
      score += 2;
      reasons.push({ type: 'preferred_city', values: [row.city] });
    }
  }

  if (signals.budgetMax !== null && row.price_min !== null && row.price_min !== undefined) {
    const priceMin = Number(row.price_min);
    if (!Number.isNaN(priceMin)) {
      if (priceMin <= signals.budgetMax) {
        score += 1;
        reasons.push({ type: 'within_budget' });
      } else {
        score -= 2;
        reasons.push({ type: 'over_budget' });
      }
    }
  }

  const startTime = row.start_time ? new Date(row.start_time) : null;
  if (startTime && !Number.isNaN(startTime.getTime())) {
    const daysOut = (startTime.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    if (daysOut >= 0 && daysOut <= 30) {
      const boost = Math.max(0, (30 - daysOut) / 30);
      if (boost > 0) {
        score += boost;
        reasons.push({ type: 'soon' });
      }
    }
    if (signals.nightPreferences.length > 0) {
      const day = startTime.getUTCDay();
      const isWeekend = day === 0 || day === 6;
      if (isWeekend && signals.nightPreferences.includes('weekend')) {
        score += 1;
        reasons.push({ type: 'weekend' });
      }
      if (!isWeekend && signals.nightPreferences.includes('weekday')) {
        score += 1;
        reasons.push({ type: 'weekday' });
      }
    }
  }

  return { score, reasons };
};

const hydratePlan = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    city: row.city,
    start_date: row.start_date ? new Date(row.start_date).toISOString() : null,
    end_date: row.end_date ? new Date(row.end_date).toISOString() : null,
    capacity: row.capacity,
    budget_min: row.budget_min === null ? null : Number(row.budget_min),
    budget_max: row.budget_max === null ? null : Number(row.budget_max),
    genres: parseJson(row.genres),
    gear_needs: parseJson(row.gear_needs),
    vibe_tags: parseJson(row.vibe_tags),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
};

const fetchPlanById = async (planId, userId) => {
  const [rows] = await pool.query(
    'SELECT * FROM event_plans WHERE id = ? AND user_id = ?',
    [planId, userId]
  );
  if (!rows.length) return null;
  return hydratePlan(rows[0]);
};

app.get('/v1/events/search', async (req, res) => {
  const schema = z.object({
    city: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    genres: z.string().optional(),
    priceMax: z.string().optional(),
    source: z.enum(['eventbrite', 'ticketmaster', 'xraves', 'local']).optional(),
    rank: z.enum(['time', 'personalized']).optional(),
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
    rank,
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
      where.push("JSON_SEARCH(genres, 'one', ?) IS NOT NULL");
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

  let ranked = false;
  let scoresByEvent = new Map();

  let userId = null;
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    try {
      const payload = jwt.verify(authHeader.slice(7), JWT_SECRET);
      userId = payload?.user_id || null;
    } catch {
      userId = null;
    }
  }

  if (userId && (rank === 'personalized' || rank === undefined)) {
    try {
      const signals = await getUserSignals(userId);
      const scored = rows.map(row => {
        const scoreData = scoreEventRow(row, signals);
        scoresByEvent.set(row.id, scoreData);
        return { row, scoreData };
      });
      scored.sort((a, b) => {
        if (b.scoreData.score !== a.scoreData.score) {
          return b.scoreData.score - a.scoreData.score;
        }
        const aTime = a.row.start_time ? new Date(a.row.start_time).getTime() : 0;
        const bTime = b.row.start_time ? new Date(b.row.start_time).getTime() : 0;
        return aTime - bTime;
      });
      ranked = true;
      rows.splice(0, rows.length, ...scored.map(item => item.row));
    } catch (err) {
      console.warn('Personalization failed; falling back to time order:', err.message);
    }
  }

  const events = rows.map(row => {
    const payload = buildEventResponse(row, sourcesByEvent.get(row.id) || []);
    if (scoresByEvent.has(row.id)) {
      const scoreData = scoresByEvent.get(row.id);
      payload.rank_score = Number(scoreData.score.toFixed(3));
      payload.rank_reasons = scoreData.reasons;
    }
    return payload;
  });

  return res.json({ events, count: events.length, ranked });
});

app.get('/v1/users/me/feed', requireAuth, async (req, res) => {
  const schema = z.object({
    city: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    limit: z.string().optional(),
    offset: z.string().optional()
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    return sendError(res, 400, 'invalid_query', 'Invalid query parameters', parsed.error.flatten());
  }

  const userId = req.user?.user_id;
  if (!userId) {
    return sendError(res, 401, 'unauthorized', 'Invalid user token');
  }

  const { city, from, to, limit, offset } = parsed.data;
  const fromDate = parseDateParam(from, new Date());
  const toDate = parseDateParam(to, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

  await syncLocalEventsToCanonical();
  await maybeTriggerIngestion(city || INGESTION_DEFAULT_CITY, fromDate, toDate);
  const signals = await getUserSignals(userId);

  const where = [];
  const params = [];

  where.push('start_time >= ?');
  params.push(fromDate.toISOString().slice(0, 19).replace('T', ' '));
  where.push('start_time <= ?');
  params.push(toDate.toISOString().slice(0, 19).replace('T', ' '));

  if (city) {
    where.push('LOWER(city) = LOWER(?)');
    params.push(city);
  } else if (signals.preferredCities.length > 0) {
    const placeholders = signals.preferredCities.map(() => '?').join(',');
    where.push(`LOWER(city) IN (${placeholders})`);
    params.push(...signals.preferredCities);
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

  const scored = rows.map(row => {
    const ranking = scoreEventRow(row, signals);
    return {
      event: buildEventResponse(row, sourcesByEvent.get(row.id) || []),
      ranking
    };
  });

  scored.sort((a, b) => {
    if (b.ranking.score !== a.ranking.score) {
      return b.ranking.score - a.ranking.score;
    }
    const aStart = a.event.start_time ? new Date(a.event.start_time).getTime() : 0;
    const bStart = b.event.start_time ? new Date(b.event.start_time).getTime() : 0;
    return aStart - bStart;
  });

  const events = scored.map(item => ({
    ...item.event,
    ranking: item.ranking
  }));

  return res.json({ events, count: events.length });
});

const planSchema = z.object({
  name: z.string().min(1),
  city: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  capacity: z.coerce.number().int().positive().optional(),
  budget_min: z.coerce.number().nonnegative().optional(),
  budget_max: z.coerce.number().nonnegative().optional(),
  genres: z.array(z.string()).optional(),
  gear_needs: z.array(z.string()).optional(),
  vibe_tags: z.array(z.string()).optional()
});

const planUpdateSchema = planSchema.partial();

app.post('/v1/organizer/plans', requireAuth, requireOrganizer, async (req, res) => {
  const parsed = planSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'invalid_body', 'Invalid request body', parsed.error.flatten());
  }
  const data = parsed.data;
  const startDate = toMysqlDateTime(data.start_date);
  const endDate = toMysqlDateTime(data.end_date);
  const [result] = await pool.execute(
    `INSERT INTO event_plans
      (user_id, name, city, start_date, end_date, capacity, budget_min, budget_max, genres, gear_needs, vibe_tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      req.user.user_id,
      data.name,
      data.city || null,
      startDate,
      endDate,
      data.capacity ?? null,
      data.budget_min ?? null,
      data.budget_max ?? null,
      JSON.stringify(data.genres || []),
      JSON.stringify(data.gear_needs || []),
      JSON.stringify(data.vibe_tags || [])
    ]
  );
  const plan = await fetchPlanById(result.insertId, req.user.user_id);
  return res.status(201).json({ plan });
});

app.get('/v1/organizer/plans', requireAuth, requireOrganizer, async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM event_plans WHERE user_id = ? ORDER BY created_at DESC',
    [req.user.user_id]
  );
  return res.json({ plans: rows.map(hydratePlan) });
});

app.get('/v1/organizer/plans/:id', requireAuth, requireOrganizer, async (req, res) => {
  const planId = parseIdParam(req.params.id);
  if (planId === null) {
    return sendError(res, 400, 'invalid_id', 'Invalid plan id');
  }
  const plan = await fetchPlanById(planId, req.user.user_id);
  if (!plan) {
    return sendError(res, 404, 'not_found', 'Plan not found');
  }
  return res.json({ plan });
});

app.put('/v1/organizer/plans/:id', requireAuth, requireOrganizer, async (req, res) => {
  const planId = parseIdParam(req.params.id);
  if (planId === null) {
    return sendError(res, 400, 'invalid_id', 'Invalid plan id');
  }
  const parsed = planUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'invalid_body', 'Invalid request body', parsed.error.flatten());
  }
  const existing = await fetchPlanById(planId, req.user.user_id);
  if (!existing) {
    return sendError(res, 404, 'not_found', 'Plan not found');
  }
  const data = { ...existing, ...parsed.data };
  const startDate = toMysqlDateTime(data.start_date);
  const endDate = toMysqlDateTime(data.end_date);
  await pool.execute(
    `UPDATE event_plans
      SET name = ?, city = ?, start_date = ?, end_date = ?, capacity = ?, budget_min = ?, budget_max = ?,
          genres = ?, gear_needs = ?, vibe_tags = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?`,
    [
      data.name,
      data.city || null,
      startDate,
      endDate,
      data.capacity ?? null,
      data.budget_min ?? null,
      data.budget_max ?? null,
      JSON.stringify(data.genres || []),
      JSON.stringify(data.gear_needs || []),
      JSON.stringify(data.vibe_tags || []),
      planId,
      req.user.user_id
    ]
  );
  const plan = await fetchPlanById(planId, req.user.user_id);
  return res.json({ plan });
});

const buildPlanFilters = (plan, overrides = {}) => {
  return {
    city: overrides.city || plan.city || null,
    genres: overrides.genres || plan.genres || [],
    budget_min: overrides.budget_min ?? plan.budget_min ?? null,
    budget_max: overrides.budget_max ?? plan.budget_max ?? null,
    capacity: overrides.capacity ?? plan.capacity ?? null
  };
};

const scoreDjForPlan = (dj, filters) => {
  const reasons = [];
  let score = 0;
  const djGenres = normalizeTokenList(dj.genres);
  const planGenres = normalizeTokenList(filters.genres);
  const genreMatches = planGenres.filter(g => djGenres.includes(g));
  if (genreMatches.length) {
    score += genreMatches.length * 3;
    reasons.push({ type: 'genre_match', values: genreMatches.slice(0, 3) });
  }
  if (filters.city && dj.city) {
    const cityMatch = normalizeToken(dj.city).includes(normalizeToken(filters.city));
    if (cityMatch) {
      score += 2;
      reasons.push({ type: 'city_match', values: [dj.city.trim()] });
    }
  }
  if (filters.budget_max !== null && dj.numeric_fee !== null && dj.numeric_fee !== undefined) {
    const fee = Number(dj.numeric_fee);
    if (!Number.isNaN(fee)) {
      if (fee <= filters.budget_max) {
        score += 2;
        reasons.push({ type: 'within_budget' });
      } else {
        score -= 1;
        reasons.push({ type: 'over_budget' });
      }
    }
  }
  return { score, reasons };
};

app.post('/v1/organizer/plans/:id/search/djs', requireAuth, requireOrganizer, async (req, res) => {
  const planId = parseIdParam(req.params.id);
  if (planId === null) {
    return sendError(res, 400, 'invalid_id', 'Invalid plan id');
  }
  const plan = await fetchPlanById(planId, req.user.user_id);
  if (!plan) {
    return sendError(res, 404, 'not_found', 'Plan not found');
  }
  const schema = z.object({
    city: z.string().optional(),
    genres: z.array(z.string()).optional(),
    budget_max: z.coerce.number().nonnegative().optional()
  });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    return sendError(res, 400, 'invalid_body', 'Invalid request body', parsed.error.flatten());
  }
  const filters = buildPlanFilters(plan, parsed.data);
  const [rows] = await pool.query('SELECT * FROM djs');
  const scored = rows.map(dj => ({
    dj,
    match: scoreDjForPlan(dj, filters)
  }));
  scored.sort((a, b) => b.match.score - a.match.score);
  return res.json({
    plan_id: planId,
    results: scored.map(item => ({
      ...item.dj,
      match: item.match
    }))
  });
});

const scoreVenueForPlan = (venue, filters) => {
  const reasons = [];
  let score = 0;
  const venueGenres = normalizeTokenList(venue.genreFocus);
  const planGenres = normalizeTokenList(filters.genres);
  const genreMatches = planGenres.filter(g => venueGenres.includes(g));
  if (genreMatches.length) {
    score += genreMatches.length * 2;
    reasons.push({ type: 'genre_match', values: genreMatches.slice(0, 3) });
  }
  if (filters.city && venue.address) {
    const cityMatch = normalizeToken(venue.address).includes(normalizeToken(filters.city));
    if (cityMatch) {
      score += 2;
      reasons.push({ type: 'city_match', values: [filters.city] });
    }
  }
  if (filters.capacity && venue.capacity) {
    if (Number(venue.capacity) >= filters.capacity) {
      score += 2;
      reasons.push({ type: 'capacity_ok' });
    } else {
      score -= 1;
      reasons.push({ type: 'capacity_low' });
    }
  }
  return { score, reasons };
};

app.post('/v1/organizer/plans/:id/search/venues', requireAuth, requireOrganizer, async (req, res) => {
  const planId = parseIdParam(req.params.id);
  if (planId === null) {
    return sendError(res, 400, 'invalid_id', 'Invalid plan id');
  }
  const plan = await fetchPlanById(planId, req.user.user_id);
  if (!plan) {
    return sendError(res, 404, 'not_found', 'Plan not found');
  }
  const schema = z.object({
    city: z.string().optional(),
    genres: z.array(z.string()).optional(),
    capacity: z.coerce.number().int().positive().optional()
  });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    return sendError(res, 400, 'invalid_body', 'Invalid request body', parsed.error.flatten());
  }
  const filters = buildPlanFilters(plan, parsed.data);
  const [rows] = await pool.query('SELECT * FROM venues');
  const scored = rows.map(venue => ({
    venue,
    match: scoreVenueForPlan(venue, filters)
  }));
  scored.sort((a, b) => b.match.score - a.match.score);
  return res.json({
    plan_id: planId,
    results: scored.map(item => ({
      ...item.venue,
      match: item.match
    }))
  });
});

app.post('/v1/organizer/plans/:id/shortlist', requireAuth, requireOrganizer, async (req, res) => {
  const planId = parseIdParam(req.params.id);
  if (planId === null) {
    return sendError(res, 400, 'invalid_id', 'Invalid plan id');
  }
  const plan = await fetchPlanById(planId, req.user.user_id);
  if (!plan) {
    return sendError(res, 404, 'not_found', 'Plan not found');
  }
  const schema = z.object({
    item_type: z.enum(['dj', 'venue']),
    item_id: z.coerce.number().int().positive()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'invalid_body', 'Invalid request body', parsed.error.flatten());
  }
  await pool.execute(
    `INSERT INTO event_plan_shortlists (plan_id, item_type, item_id)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE created_at = CURRENT_TIMESTAMP`,
    [planId, parsed.data.item_type, parsed.data.item_id]
  );
  return res.status(201).json({ saved: true });
});

app.get('/v1/organizer/plans/:id/shortlist', requireAuth, requireOrganizer, async (req, res) => {
  const planId = parseIdParam(req.params.id);
  if (planId === null) {
    return sendError(res, 400, 'invalid_id', 'Invalid plan id');
  }
  const plan = await fetchPlanById(planId, req.user.user_id);
  if (!plan) {
    return sendError(res, 404, 'not_found', 'Plan not found');
  }
  const [rows] = await pool.query(
    'SELECT item_type, item_id, created_at FROM event_plan_shortlists WHERE plan_id = ? ORDER BY created_at DESC',
    [planId]
  );
  const djIds = rows.filter(r => r.item_type === 'dj').map(r => r.item_id);
  const venueIds = rows.filter(r => r.item_type === 'venue').map(r => r.item_id);
  let djsById = {};
  let venuesById = {};
  if (djIds.length) {
    const [djs] = await pool.query(
      `SELECT * FROM djs WHERE dj_id IN (${djIds.map(() => '?').join(',')})`,
      djIds
    );
    djsById = djs.reduce((acc, dj) => {
      acc[dj.dj_id] = dj;
      return acc;
    }, {});
  }
  if (venueIds.length) {
    const [venues] = await pool.query(
      `SELECT * FROM venues WHERE id IN (${venueIds.map(() => '?').join(',')})`,
      venueIds
    );
    venuesById = venues.reduce((acc, venue) => {
      acc[venue.id] = venue;
      return acc;
    }, {});
  }
  const items = rows.map(row => ({
    item_type: row.item_type,
    item_id: row.item_id,
    created_at: row.created_at,
    item: row.item_type === 'dj' ? djsById[row.item_id] : venuesById[row.item_id]
  }));
  return res.json({ plan_id: planId, items });
});

app.post('/v1/organizer/contact-requests', requireAuth, requireOrganizer, async (req, res) => {
  const schema = z.object({
    plan_id: z.coerce.number().int().positive().optional(),
    item_type: z.enum(['dj', 'venue']),
    item_id: z.coerce.number().int().positive(),
    message: z.string().min(1)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'invalid_body', 'Invalid request body', parsed.error.flatten());
  }
  const planId = parsed.data.plan_id ?? null;
  if (planId) {
    const plan = await fetchPlanById(planId, req.user.user_id);
    if (!plan) {
      return sendError(res, 404, 'not_found', 'Plan not found');
    }
  }
  const [result] = await pool.execute(
    `INSERT INTO contact_requests (user_id, plan_id, item_type, item_id, message)
     VALUES (?, ?, ?, ?, ?)`,
    [req.user.user_id, planId, parsed.data.item_type, parsed.data.item_id, parsed.data.message]
  );
  return res.status(201).json({ requested: true, id: result.insertId });
});

app.get('/v1/organizer/contact-requests', requireAuth, requireOrganizer, async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM contact_requests WHERE user_id = ? ORDER BY created_at DESC',
    [req.user.user_id]
  );
  return res.json({ requests: rows });
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
    await triggerIngestion('xraves', INGESTION_DEFAULT_CITY, start, end);
  };
  runScheduledIngestion();
  setInterval(runScheduledIngestion, INGESTION_STALE_HOURS * 60 * 60 * 1000);
}

app.listen(API_PORT, () => {
  console.log(`Local Events Service running on port ${API_PORT}`);
});
