// local-events-service/index.js

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const { z } = require('zod');
const jwt = require('jsonwebtoken');
const {
  ingestTicketmaster,
  ingestEventbrite,
  ingestBandsintownArtists,
  ingestDiceApify,
  upsertEvent,
  upsertSourceEvent
} = require('./ingestion');
const rateLimit = require('express-rate-limit');
const spotifyClient = require('./spotify-client');
const mixcloudClient = require('./mixcloud-client');

// Adjust these env vars / defaults as needed
const DB_HOST = process.env.DB_HOST || 'db';
const DB_PORT = process.env.DB_PORT || '3306';
const DB_USER = process.env.DB_USER || 'app';
const DB_PASSWORD = process.env.DB_PASSWORD || 'app';
const DB_NAME = process.env.DB_NAME || 'gigsdb';
const API_PORT = process.env.API_PORT || process.env.EVENTS_SERVICE_PORT || 4003;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const SERVICE_NAME = 'events-service';

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
const DICE_APIFY_ENABLED = (process.env.DICE_APIFY_ENABLED || 'false') === 'true';
const DICE_APIFY_ACTOR = process.env.DICE_APIFY_ACTOR || 'lexis-solutions~dice-fm';
const DICE_APIFY_MAX_ITEMS = Number.parseInt(process.env.DICE_APIFY_MAX_ITEMS || '200', 10);
const DICE_APIFY_USE_PROXY = (process.env.DICE_APIFY_USE_PROXY || 'true') === 'true';
const APIFY_TOKEN = process.env.APIFY_TOKEN || null;
const BANDSINTOWN_APP_ID = process.env.BANDSINTOWN_APP_ID || null;
const BANDSINTOWN_MAX_ARTISTS = Number.parseInt(process.env.BANDSINTOWN_MAX_ARTISTS || '15', 10);
const BANDSINTOWN_MAX_EVENTS = Number.parseInt(process.env.BANDSINTOWN_MAX_EVENTS || '300', 10);
const BANDSINTOWN_SEED_ARTISTS = process.env.BANDSINTOWN_SEED_ARTISTS
  ? process.env.BANDSINTOWN_SEED_ARTISTS.split(',').map(name => name.trim()).filter(Boolean)
  : [];
const BANDSINTOWN_ALLOW_ANY_ARTIST = (process.env.BANDSINTOWN_ALLOW_ANY_ARTIST || 'false') === 'true';
const BANDSINTOWN_USER_SYNC_HOURS = Number.parseInt(process.env.BANDSINTOWN_USER_SYNC_HOURS || '12', 10);
const BANDSINTOWN_USER_MAX_ARTISTS = Number.parseInt(process.env.BANDSINTOWN_USER_MAX_ARTISTS || '10', 10);
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || null;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || null;
const MIXCLOUD_ENABLED = (process.env.MIXCLOUD_ENABLED || 'true') === 'true';

const warnOnMissingEnv = () => {
  const missing = [];
  const warnings = [];
  if (!DB_HOST) missing.push('DB_HOST');
  if (!DB_USER) missing.push('DB_USER');
  if (!DB_PASSWORD) missing.push('DB_PASSWORD');
  if (!DB_NAME) missing.push('DB_NAME');
  if (!JWT_SECRET || JWT_SECRET === 'dev-secret') warnings.push('JWT_SECRET is using the default dev value');
  if (INGESTION_ENABLED && !TICKETMASTER_API_KEY) warnings.push('INGESTION_ENABLED without TICKETMASTER_API_KEY');
  if (INGESTION_ENABLED && !EVENTBRITE_API_TOKEN) warnings.push('INGESTION_ENABLED without EVENTBRITE_API_TOKEN');
  if (DICE_APIFY_ENABLED && !APIFY_TOKEN) warnings.push('DICE_APIFY_ENABLED without APIFY_TOKEN');
  if (BANDSINTOWN_APP_ID === null) warnings.push('BANDSINTOWN_APP_ID not set');

  const messages = [];
  if (missing.length) messages.push(`Missing required env: ${missing.join(', ')}`);
  if (warnings.length) messages.push(...warnings);
  if (messages.length === 0) return;
  const text = `[${SERVICE_NAME}] ${messages.join(' | ')}`;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(text);
  }
  console.warn(text);
};

warnOnMissingEnv();

const logRequest = ({ requestId, method, path, status, durationMs }) => {
  const payload = {
    level: 'info',
    service: SERVICE_NAME,
    request_id: requestId,
    method,
    path,
    status,
    duration_ms: durationMs,
    timestamp: new Date().toISOString()
  };
  console.log(JSON.stringify(payload));
};

const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

const ensureEventsSchema = async () => {
  try {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS user_hidden_events (
        user_id INT NOT NULL,
        event_id INT NOT NULL,
        hidden_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, event_id),
        KEY user_hidden_events_event_idx (event_id),
        CONSTRAINT fk_hidden_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_hidden_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`
    );
    await pool.query(
      `CREATE TABLE IF NOT EXISTS user_alerts (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        artist_name VARCHAR(255) NOT NULL,
        city VARCHAR(100),
        radius_km INT,
        last_notified_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX user_alerts_user_idx (user_id),
        CONSTRAINT fk_user_alerts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`
    );
    await pool.query(
      `CREATE TABLE IF NOT EXISTS event_plans (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        city VARCHAR(100),
        start_date DATETIME,
        end_date DATETIME,
        capacity INT,
        budget_min DECIMAL(10,2),
        budget_max DECIMAL(10,2),
        genres JSON,
        gear_needs JSON,
        vibe_tags JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX event_plans_user_idx (user_id),
        CONSTRAINT fk_event_plans_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`
    );
    await pool.query(
      `CREATE TABLE IF NOT EXISTS event_plan_shortlists (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        plan_id INT NOT NULL,
        item_type VARCHAR(16) NOT NULL,
        item_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_plan_item (plan_id, item_type, item_id),
        CONSTRAINT fk_plan_shortlist_plan FOREIGN KEY (plan_id) REFERENCES event_plans(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`
    );
    await pool.query(
      `CREATE TABLE IF NOT EXISTS contact_requests (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        plan_id INT DEFAULT NULL,
        item_type VARCHAR(16) NOT NULL,
        item_id INT NOT NULL,
        message TEXT NOT NULL,
        status VARCHAR(32) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX contact_requests_user_idx (user_id),
        CONSTRAINT fk_contact_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_contact_plan FOREIGN KEY (plan_id) REFERENCES event_plans(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`
    );
  } catch (err) {
    console.error('[events-service] Schema check failed:', err.message);
  }
};

if (process.env.NODE_ENV !== 'test') {
  void ensureEventsSchema();
}

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
    logRequest({
      requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs
    });
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

const requireAdmin = (req, res, next) => {
  const role = req.user?.role;
  if (role === 'admin') {
    return next();
  }
  return sendError(res, 403, 'forbidden', 'Admin role required');
};

const inflightIngestion = new Set();
const userBandsintownSync = new Map();

const filterBandsintownArtists = (artists) => {
  const cleaned = dedupeList(artists);
  if (BANDSINTOWN_ALLOW_ANY_ARTIST) {
    return cleaned;
  }
  if (BANDSINTOWN_SEED_ARTISTS.length === 0) {
    return [];
  }
  const allowed = new Set(BANDSINTOWN_SEED_ARTISTS.map(normalizeToken));
  return cleaned.filter(name => allowed.has(normalizeToken(name)));
};

const getBandsintownSeedArtists = async () => {
  const seeds = [...BANDSINTOWN_SEED_ARTISTS];
  if (seeds.length >= BANDSINTOWN_MAX_ARTISTS) {
    return dedupeList(seeds).slice(0, BANDSINTOWN_MAX_ARTISTS);
  }
  try {
    const [rows] = await pool.query(
      'SELECT dj_name FROM djs WHERE dj_name IS NOT NULL AND dj_name != "" LIMIT ?',
      [BANDSINTOWN_MAX_ARTISTS]
    );
    const djNames = rows.map(row => row.dj_name);
    return dedupeList([...seeds, ...djNames]).slice(0, BANDSINTOWN_MAX_ARTISTS);
  } catch (err) {
    console.warn('Failed to load DJ names for Bandsintown seed:', err.message);
    return dedupeList(seeds).slice(0, BANDSINTOWN_MAX_ARTISTS);
  }
};

const maybeTriggerBandsintownForUser = async (userId, city, startDate, endDate) => {
  if (!BANDSINTOWN_APP_ID) return;
  const lastSync = userBandsintownSync.get(userId);
  if (lastSync && Date.now() - lastSync < BANDSINTOWN_USER_SYNC_HOURS * 60 * 60 * 1000) {
    return;
  }

  try {
    const signals = await getUserSignals(userId);
    const spotifyArtists = (signals.spotifyArtists || []).slice(0, BANDSINTOWN_USER_MAX_ARTISTS);
    const artists = filterBandsintownArtists(spotifyArtists);
    if (artists.length === 0) return;

    userBandsintownSync.set(userId, Date.now());
    setImmediate(() => ingestBandsintownArtists(pool, {
      artists,
      appId: BANDSINTOWN_APP_ID,
      startDate,
      endDate,
      city: city || INGESTION_DEFAULT_CITY,
      maxArtists: BANDSINTOWN_USER_MAX_ARTISTS,
      maxEvents: BANDSINTOWN_MAX_EVENTS
    }).catch(err => {
      console.warn('Bandsintown user ingestion failed:', err.message);
    }));
  } catch (err) {
    console.warn('Bandsintown user ingestion skipped:', err.message);
  }
};

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
    if (source === 'bandsintown') {
      const artists = filterBandsintownArtists(await getBandsintownSeedArtists());
      if (artists.length === 0) {
        return;
      }
      await ingestBandsintownArtists(pool, {
        artists,
        appId: BANDSINTOWN_APP_ID,
        startDate,
        endDate,
        city,
        maxArtists: BANDSINTOWN_MAX_ARTISTS,
        maxEvents: BANDSINTOWN_MAX_EVENTS
      });
    }
    if (source === 'dice') {
      await ingestDiceApify(pool, {
        city,
        startDate,
        endDate,
        enabled: DICE_APIFY_ENABLED,
        actorId: DICE_APIFY_ACTOR,
        apifyToken: APIFY_TOKEN,
        maxItems: DICE_APIFY_MAX_ITEMS,
        useProxy: DICE_APIFY_USE_PROXY
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
  const sources = ['ticketmaster', 'eventbrite', 'bandsintown', 'dice'];
  sources.forEach((source) => {
    const last = lastSynced.get(source);
    if (!last || last.getTime() < staleThreshold) {
      setImmediate(() => triggerIngestion(source, city, startDate, endDate));
    }
  });
};

const syncLocalEventsToCanonical = async () => {
  const formatDateOnly = (value) => {
    if (!value) return null;
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }
    const text = value.toString();
    return text.length >= 10 ? text.slice(0, 10) : text;
  };
  const formatTimeOnly = (value) => {
    if (!value) return null;
    if (value instanceof Date) {
      return value.toISOString().slice(11, 19);
    }
    const text = value.toString();
    return text.length >= 8 ? text.slice(0, 8) : text;
  };
  const [rows] = await pool.query(
    `SELECT le.*
     FROM local_events le
     LEFT JOIN source_events se
       ON se.source = 'local' AND CAST(se.source_id AS UNSIGNED) = le.id
     WHERE se.id IS NULL`
  );
  for (const ev of rows) {
    if (!ev.event_name || !ev.date_local) continue;
    const datePart = formatDateOnly(ev.date_local);
    const timePart = formatTimeOnly(ev.time_local);
    if (!datePart) continue;
    const start = timePart ? `${datePart}T${timePart}` : `${datePart}T00:00:00`;
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
  if (typeof value === 'object' && value !== null) return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const normalizeToken = (value) => (value ?? '').toString().toLowerCase().trim();

const dedupeList = (items) => {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = normalizeToken(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
};

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

const getTokenFromRequest = (req) => {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  if (req.query && typeof req.query.token === 'string' && req.query.token.trim()) {
    return req.query.token.trim();
  }
  return null;
};

const sanitizeIcsText = (value) => {
  return (value || '')
    .toString()
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
};

const formatIcsDate = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const iso = date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return iso;
};

const buildCalendarEvent = (event) => {
  const start = formatIcsDate(event.start_time);
  if (!start) return '';
  const end = event.end_time ? formatIcsDate(event.end_time) : null;
  const lines = [
    'BEGIN:VEVENT',
    `UID:wtc-event-${event.id}@whatsthecraic`,
    `DTSTAMP:${formatIcsDate(new Date())}`,
    `DTSTART:${start}`,
    end ? `DTEND:${end}` : null,
    `SUMMARY:${sanitizeIcsText(event.title)}`,
    event.description ? `DESCRIPTION:${sanitizeIcsText(event.description)}` : null,
    event.venue_name || event.city
      ? `LOCATION:${sanitizeIcsText([event.venue_name, event.city].filter(Boolean).join(' - '))}`
      : null,
    event.ticket_url ? `URL:${sanitizeIcsText(event.ticket_url)}` : null,
    'END:VEVENT'
  ].filter(Boolean);
  return lines.join('\r\n');
};

const buildCalendarFile = (events) => {
  const body = events.map(buildCalendarEvent).filter(Boolean).join('\r\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//WhatsTheCraic//EN',
    'CALSCALE:GREGORIAN',
    body,
    'END:VCALENDAR'
  ].filter(Boolean).join('\r\n');
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

  const [savedRows] = await pool.query(
    `SELECT e.id, e.genres, e.city, e.venue_name, e.title
     FROM user_saved_events se
     JOIN events e ON e.id = se.event_id
     WHERE se.user_id = ?
     ORDER BY se.saved_at DESC
     LIMIT 80`,
    [userId]
  );
  const savedGenres = new Set();
  const savedCities = new Set();
  const savedVenues = new Set();
  const savedTitles = new Set();
  const savedEventIds = new Set();
  savedRows.forEach((saved) => {
    savedEventIds.add(saved.id);
    parseJson(saved.genres).forEach((genre) => {
      const token = normalizeToken(genre);
      if (token) savedGenres.add(token);
    });
    if (saved.city) {
      const cityToken = normalizeToken(saved.city);
      if (cityToken) savedCities.add(cityToken);
    }
    if (saved.venue_name) {
      const venueToken = normalizeToken(saved.venue_name);
      if (venueToken) savedVenues.add(venueToken);
    }
    if (saved.title) {
      const titleToken = normalizeToken(saved.title);
      if (titleToken) savedTitles.add(titleToken);
    }
  });

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
    spotifyArtists,
    savedGenres: Array.from(savedGenres),
    savedCities: Array.from(savedCities),
    savedVenues: Array.from(savedVenues),
    savedTitles: Array.from(savedTitles),
    savedEventIds
  };
};

// Genre family mapping: maps broad Ticketmaster genres ↔ specific Spotify sub-genres
const GENRE_FAMILIES = {
  dance: ['techno', 'house', 'hard techno', 'melodic techno', 'melodic house', 'tech house',
    'afro house', 'progressive house', 'hard house', 'acid techno', 'bounce', 'tekno',
    'trance', 'deep house', 'minimal techno', 'edm', 'electronic', 'electronica',
    'drum and bass', 'dnb', 'dubstep', 'garage', 'uk garage', 'bass'],
  rock: ['alternative rock', 'indie rock', 'hard rock', 'punk rock', 'punk', 'grunge',
    'post-punk', 'shoegaze', 'emo', 'psychedelic rock', 'classic rock', 'math rock'],
  pop: ['synth-pop', 'electropop', 'indie pop', 'dream pop', 'k-pop', 'j-pop',
    'art pop', 'chamber pop', 'power pop', 'pop rock'],
  'hip-hop/rap': ['hip hop', 'hip-hop', 'rap', 'trap', 'drill', 'grime',
    'boom bap', 'conscious hip hop', 'mumble rap', 'uk drill', 'lo-fi hip hop'],
  metal: ['heavy metal', 'death metal', 'black metal', 'thrash metal', 'doom metal',
    'metalcore', 'deathcore', 'nu-metal', 'progressive metal', 'power metal'],
  jazz: ['acid jazz', 'smooth jazz', 'jazz fusion', 'nu jazz', 'bebop', 'swing'],
  folk: ['indie folk', 'folk rock', 'celtic', 'irish folk', 'traditional irish',
    'acoustic', 'singer-songwriter', 'americana'],
  'r&b': ['rnb', 'neo-soul', 'soul', 'contemporary r&b', 'funk', 'motown'],
  country: ['country rock', 'alt-country', 'americana', 'bluegrass', 'country pop'],
  classical: ['orchestral', 'chamber music', 'opera', 'contemporary classical']
};

// Build reverse lookup: sub-genre → [parent genres]
const GENRE_REVERSE = {};
for (const [parent, children] of Object.entries(GENRE_FAMILIES)) {
  GENRE_REVERSE[parent] = [parent];
  for (const child of children) {
    if (!GENRE_REVERSE[child]) GENRE_REVERSE[child] = [];
    GENRE_REVERSE[child].push(parent);
    if (!GENRE_REVERSE[parent].includes(child)) GENRE_REVERSE[parent].push(...children);
  }
}

// Expand a genre list to include related genres from the family map
const expandGenres = (genreList) => {
  const expanded = new Set(genreList);
  for (const g of genreList) {
    // If g is a parent genre, add all children
    if (GENRE_FAMILIES[g]) {
      GENRE_FAMILIES[g].forEach(child => expanded.add(child));
    }
    // If g is a child, add the parent
    if (GENRE_REVERSE[g]) {
      GENRE_REVERSE[g].forEach(parent => expanded.add(parent));
    }
  }
  return Array.from(expanded);
};

const scoreEventRow = (row, signals) => {
  const reasons = [];
  let score = 0;

  const savedGenres = signals.savedGenres || [];
  const savedCities = signals.savedCities || [];
  const savedVenues = signals.savedVenues || [];
  const savedTitles = signals.savedTitles || [];

  const genres = parseJson(row.genres).map(normalizeToken).filter(Boolean);
  // Expand event genres to include related sub-genres
  const expandedEventGenres = expandGenres(genres);
  const title = normalizeToken(row.title);
  const description = normalizeToken(row.description);

  // Direct genre match = +3 per match
  const genreMatches = expandedEventGenres.filter(g => signals.preferredGenres.includes(g));
  if (genreMatches.length > 0) {
    score += Math.min(genreMatches.length, 3) * 3;
    reasons.push({ type: 'preferred_genre', values: genreMatches.slice(0, 3) });
  }

  // Spotify genre match via expanded genres = +2 per match
  const spotifyGenreMatches = expandedEventGenres.filter(g => signals.spotifyGenres.includes(g));
  if (spotifyGenreMatches.length > 0) {
    score += Math.min(spotifyGenreMatches.length, 5) * 2;
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

  if (signals.savedEventIds?.has(row.id)) {
    score += 7;
    reasons.push({ type: 'saved_event' });
  }

  const savedGenreMatches = genres.filter(g => savedGenres.includes(g));
  if (savedGenreMatches.length > 0) {
    score += savedGenreMatches.length * 2;
    reasons.push({ type: 'saved_genre', values: savedGenreMatches.slice(0, 3) });
  }

  const cityToken = normalizeToken(row.city);
  if (signals.savedCities.includes(cityToken)) {
    score += 2;
    reasons.push({ type: 'saved_city', values: [row.city] });
  }

  if (signals.savedVenues.includes(venueName)) {
    score += 2;
    reasons.push({ type: 'saved_venue', values: [row.venue_name] });
  }

  if (savedTitles.includes(title)) {
    score += 2;
    reasons.push({ type: 'saved_title' });
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
    q: z.string().optional(),
    artist: z.string().optional(),
    venue: z.string().optional(),
    priceMax: z.string().optional(),
    source: z.enum(['eventbrite', 'ticketmaster', 'bandsintown', 'dice', 'local']).optional(),
    rank: z.enum(['time', 'personalized']).optional(),
    includeHidden: z.string().optional(),
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
    q,
    artist,
    venue,
    priceMax,
    source,
    rank,
    includeHidden,
    limit,
    offset
  } = parsed.data;

  const fromDate = parseDateParam(from, new Date());
  const toDate = parseDateParam(to, new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));

  await syncLocalEventsToCanonical();
  await maybeTriggerIngestion(city || INGESTION_DEFAULT_CITY, fromDate, toDate);

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
  const allowHidden = includeHidden === 'true' || includeHidden === '1';

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

  if (q) {
    const keyword = `%${q.toLowerCase()}%`;
    where.push('(LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(venue_name) LIKE ?)');
    params.push(keyword, keyword, keyword);
  }

  if (artist) {
    const keyword = `%${artist.toLowerCase()}%`;
    where.push('(LOWER(title) LIKE ? OR JSON_SEARCH(tags, \"one\", ?) IS NOT NULL)');
    params.push(keyword, normalizeToken(artist));
  }

  if (venue) {
    const keyword = `%${venue.toLowerCase()}%`;
    where.push('LOWER(venue_name) LIKE ?');
    params.push(keyword);
  }

  if (source) {
    where.push('EXISTS (SELECT 1 FROM source_events se WHERE se.event_id = events.id AND se.source = ?)');
    params.push(source);
  }

  if (userId && !allowHidden) {
    where.push('events.id NOT IN (SELECT event_id FROM user_hidden_events WHERE user_id = ?)');
    params.push(userId);
  }

  const parsedLimit = Number.parseInt(limit || '200', 10);
  const limitValue = Number.isNaN(parsedLimit) ? 200 : Math.min(parsedLimit, 500);
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

  if (userId) {
    void maybeTriggerBandsintownForUser(userId, city || INGESTION_DEFAULT_CITY, fromDate, toDate);
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

app.get('/v1/performers', async (req, res) => {
  const schema = z.object({
    city: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    q: z.string().optional(),
    include: z.string().optional(),
    limit: z.string().optional()
  });
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    return sendError(res, 400, 'invalid_query', 'Invalid query parameters', parsed.error.flatten());
  }

  const {
    city,
    from,
    to,
    q,
    include,
    limit
  } = parsed.data;

  const includeSet = new Set(
    (include ? include.split(',') : ['local', 'ticketmaster', 'mixcloud'])
      .map(item => normalizeToken(item))
      .filter(Boolean)
  );

  const fromDate = parseDateParam(from, new Date());
  const toDate = parseDateParam(to, new Date(Date.now() + 90 * 24 * 60 * 60 * 1000));
  const limitValue = Math.min(Number.parseInt(limit || '200', 10) || 200, 500);
  const keyword = q ? normalizeToken(q) : '';

  const performers = [];

  if (includeSet.has('local')) {
    const params = [];
    let whereSql = '';
    if (city) {
      whereSql = 'WHERE LOWER(city) LIKE ?';
      params.push(`%${city.toLowerCase()}%`);
    }
    const [rows] = await pool.query(
      `SELECT dj_name, genres, city, instagram, soundcloud, numeric_fee, currency FROM djs ${whereSql} LIMIT ?`,
      [...params, limitValue]
    );
    rows.forEach(row => {
      if (!row.dj_name) return;
      performers.push({
        name: row.dj_name,
        source: 'local',
        city: row.city || null,
        genres: row.genres || null,
        instagram: row.instagram || null,
        soundcloud: row.soundcloud || null,
        fee: row.numeric_fee === null ? null : Number(row.numeric_fee),
        currency: row.currency || 'EUR'
      });
    });
  }

  if (includeSet.has('ticketmaster')) {
    const params = [
      fromDate.toISOString().slice(0, 19).replace('T', ' '),
      toDate.toISOString().slice(0, 19).replace('T', ' ')
    ];
    let whereSql = 'WHERE se.source = ? AND e.start_time >= ? AND e.start_time <= ?';
    params.unshift('ticketmaster');
    if (city) {
      whereSql += ' AND LOWER(e.city) = LOWER(?)';
      params.push(city);
    }
    const [rows] = await pool.query(
      `SELECT se.raw_payload
       FROM source_events se
       JOIN events e ON e.id = se.event_id
       ${whereSql}
       LIMIT ?`,
      [...params, limitValue]
    );
    rows.forEach(row => {
      const payload = parseJson(row.raw_payload, null);
      const attractions = payload?._embedded?.attractions || [];
      attractions.forEach(attraction => {
        const name = attraction?.name;
        if (!name) return;
        performers.push({
          name,
          source: 'ticketmaster'
        });
      });
    });
  }

  if (includeSet.has('bandsintown')) {
    const params = [
      fromDate.toISOString().slice(0, 19).replace('T', ' '),
      toDate.toISOString().slice(0, 19).replace('T', ' ')
    ];
    let whereSql = 'WHERE se.source = ? AND e.start_time >= ? AND e.start_time <= ?';
    params.unshift('bandsintown');
    if (city) {
      whereSql += ' AND LOWER(e.city) = LOWER(?)';
      params.push(city);
    }
    const [rows] = await pool.query(
      `SELECT DISTINCT e.title, se.raw_payload
       FROM source_events se
       JOIN events e ON e.id = se.event_id
       ${whereSql}
       LIMIT ?`,
      [...params, limitValue]
    );
    rows.forEach(row => {
      const payload = parseJson(row.raw_payload, null);
      const artistName = payload?.artist?.name || payload?.lineup?.[0] || null;
      const imageUrl = payload?.artist?.image_url || null;
      if (artistName) {
        performers.push({
          name: artistName,
          source: 'bandsintown',
          image: imageUrl,
          genres: null
        });
      }
    });
  }

  if (includeSet.has('spotify') && SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET) {
    try {
      const searchQuery = keyword || 'irish artist';
      const artists = await spotifyClient.searchArtists(SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, searchQuery, 30);
      artists.forEach(a => {
        performers.push({
          name: a.name,
          source: 'spotify',
          image: a.image,
          genres: a.genres.length ? a.genres.join(', ') : null,
          popularity: a.popularity,
          followers: a.followers,
          spotifyUrl: a.spotifyUrl,
          spotifyId: a.spotifyId
        });
      });
    } catch (err) {
      console.warn('[performers] Spotify search failed:', err.message);
    }
  }

  if (includeSet.has('mixcloud') && MIXCLOUD_ENABLED) {
    try {
      const searchQuery = keyword || 'dublin dj';
      const djs = await mixcloudClient.searchDJs(searchQuery, 20);
      for (const dj of djs) {
        let genres = null;
        try {
          const casts = await mixcloudClient.getDJCloudcasts(dj.username, 5);
          const allTags = casts.flatMap(c => c.tags);
          const unique = [...new Set(allTags)].slice(0, 5);
          if (unique.length) genres = unique.join(', ');
        } catch { /* skip genre extraction on error */ }
        performers.push({
          name: dj.name,
          source: 'mixcloud',
          image: dj.image,
          genres,
          mixcloudUrl: dj.url,
          username: dj.username
        });
      }
    } catch (err) {
      console.warn('[performers] Mixcloud search failed:', err.message);
    }
  }

  const deduped = [];
  const seen = new Set();
  performers.forEach(item => {
    const key = normalizeToken(item.name);
    if (!key || seen.has(key)) return;
    if (keyword && !key.includes(keyword)) return;
    seen.add(key);
    deduped.push(item);
  });

  return res.json({ performers: deduped, count: deduped.length });
});

app.get('/v1/users/me/feed', requireAuth, async (req, res) => {
  const schema = z.object({
    city: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    q: z.string().optional(),
    genres: z.string().optional(),
    artist: z.string().optional(),
    venue: z.string().optional(),
    priceMax: z.string().optional(),
    source: z.enum(['eventbrite', 'ticketmaster', 'bandsintown', 'dice', 'local']).optional(),
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

  const { city, from, to, q, genres, artist, venue, priceMax, source, limit, offset } = parsed.data;
  const fromDate = parseDateParam(from, new Date());
  const toDate = parseDateParam(to, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));

  await syncLocalEventsToCanonical();
  await maybeTriggerIngestion(city || INGESTION_DEFAULT_CITY, fromDate, toDate);
  void maybeTriggerBandsintownForUser(userId, city || INGESTION_DEFAULT_CITY, fromDate, toDate);
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

  // Search/filter support for feed endpoint
  if (q) {
    const keyword = `%${q.toLowerCase()}%`;
    where.push('(LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(venue_name) LIKE ?)');
    params.push(keyword, keyword, keyword);
  }
  if (genres) {
    const list = genres.split(',').map(item => item.trim().toLowerCase()).filter(Boolean);
    list.forEach((genre) => {
      where.push("JSON_SEARCH(genres, 'one', ?) IS NOT NULL");
      params.push(genre);
    });
  }
  if (artist) {
    const keyword = `%${artist.toLowerCase()}%`;
    where.push('(LOWER(title) LIKE ? OR JSON_SEARCH(tags, "one", ?) IS NOT NULL)');
    params.push(keyword, normalizeToken(artist));
  }
  if (venue) {
    const keyword = `%${venue.toLowerCase()}%`;
    where.push('LOWER(venue_name) LIKE ?');
    params.push(keyword);
  }
  if (priceMax) {
    const max = Number.parseFloat(priceMax);
    if (!Number.isNaN(max)) {
      where.push('(price_min IS NULL OR price_min <= ?)');
      params.push(max);
    }
  }
  if (source) {
    where.push('EXISTS (SELECT 1 FROM source_events se WHERE se.event_id = events.id AND se.source = ?)');
    params.push(source);
  }

  where.push('events.id NOT IN (SELECT event_id FROM user_hidden_events WHERE user_id = ?)');
  params.push(userId);

  const parsedLimit = Number.parseInt(limit || '200', 10);
  const limitValue = Number.isNaN(parsedLimit) ? 200 : Math.min(parsedLimit, 500);
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

const alertSchema = z.object({
  artist_name: z.string().min(1),
  city: z.string().optional(),
  radius_km: z.coerce.number().int().positive().optional()
});

app.post('/v1/alerts', requireAuth, async (req, res) => {
  const parsed = alertSchema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'invalid_body', 'Invalid request body', parsed.error.flatten());
  }
  const { artist_name, city, radius_km } = parsed.data;
  const [result] = await pool.execute(
    `INSERT INTO user_alerts (user_id, artist_name, city, radius_km)
     VALUES (?, ?, ?, ?)`,
    [req.user.user_id, artist_name, city || null, radius_km ?? null]
  );
  const [rows] = await pool.query('SELECT * FROM user_alerts WHERE id = ?', [result.insertId]);
  return res.status(201).json({ alert: rows[0] });
});

app.get('/v1/alerts', requireAuth, async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM user_alerts WHERE user_id = ? ORDER BY created_at DESC',
    [req.user.user_id]
  );
  return res.json({ alerts: rows });
});

app.delete('/v1/alerts/:id', requireAuth, async (req, res) => {
  const alertId = parseIdParam(req.params.id);
  if (alertId === null) {
    return sendError(res, 400, 'invalid_id', 'Invalid alert id');
  }
  const [rows] = await pool.query(
    'SELECT * FROM user_alerts WHERE id = ? AND user_id = ?',
    [alertId, req.user.user_id]
  );
  if (rows.length === 0) {
    return sendError(res, 404, 'not_found', 'Alert not found');
  }
  await pool.execute('DELETE FROM user_alerts WHERE id = ?', [alertId]);
  return res.json({ deleted: true });
});

app.get('/v1/alerts/notifications', requireAuth, async (req, res) => {
  const userId = req.user.user_id;
  const [alerts] = await pool.query(
    'SELECT * FROM user_alerts WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  );
  const now = new Date();
  const fallbackStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const payload = [];

  for (const alert of alerts) {
    const since = alert.last_notified_at ? new Date(alert.last_notified_at) : fallbackStart;
    const params = [];
    const where = ['created_at >= ?'];
    params.push(since.toISOString().slice(0, 19).replace('T', ' '));

    if (alert.city) {
      where.push('LOWER(city) = LOWER(?)');
      params.push(alert.city);
    }

    const artistToken = normalizeToken(alert.artist_name);
    if (artistToken) {
      where.push('(LOWER(title) LIKE ? OR JSON_SEARCH(tags, \"one\", ?) IS NOT NULL)');
      params.push(`%${artistToken}%`, artistToken);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `SELECT * FROM events ${whereSql} ORDER BY start_time ASC LIMIT 200`,
      params
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

    if (rows.length > 0) {
      await pool.execute(
        'UPDATE user_alerts SET last_notified_at = CURRENT_TIMESTAMP WHERE id = ?',
        [alert.id]
      );
    }

    payload.push({
      alert,
      events: rows.map(row => buildEventResponse(row, sourcesByEvent.get(row.id) || []))
    });
  }

  return res.json({ alerts: payload });
});

app.get('/v1/admin/ingestion/health', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [stateRows] = await pool.query(
      `SELECT source, city, last_synced_at, window_start, window_end
       FROM ingest_state
       ORDER BY last_synced_at DESC
       LIMIT 200`
    );
    const [sourceRows] = await pool.query(
      `SELECT source, COUNT(*) AS count, MAX(last_seen_at) AS last_seen_at
       FROM source_events
       GROUP BY source`
    );
    const [[eventsTotal]] = await pool.query('SELECT COUNT(*) AS total_events FROM events');
    return res.json({
      total_events: eventsTotal?.total_events || 0,
      ingest_state: stateRows,
      source_counts: sourceRows
    });
  } catch (err) {
    console.error('Error fetching ingestion health:', err);
    return sendError(res, 500, 'internal_error', 'Failed to fetch ingestion health');
  }
});

app.get('/v1/events/:id/calendar', async (req, res) => {
  const eventId = parseIdParam(req.params.id);
  if (eventId === null) {
    return sendError(res, 400, 'invalid_id', 'Invalid event id');
  }
  const [rows] = await pool.query('SELECT * FROM events WHERE id = ?', [eventId]);
  if (rows.length === 0) {
    return sendError(res, 404, 'not_found', 'Event not found');
  }
  const calendar = buildCalendarFile([rows[0]]);
  res.set('Content-Type', 'text/calendar; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename=\"event-${eventId}.ics\"`);
  return res.send(calendar);
});

app.get('/v1/users/me/calendar', async (req, res) => {
  const token = getTokenFromRequest(req);
  if (!token) {
    return sendError(res, 401, 'unauthorized', 'Missing bearer token');
  }
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return sendError(res, 401, 'unauthorized', 'Invalid token');
  }
  const userId = payload?.user_id;
  if (!userId) {
    return sendError(res, 401, 'unauthorized', 'Invalid token');
  }
  const [rows] = await pool.query(
    `SELECT e.*
     FROM user_saved_events se
     JOIN events e ON e.id = se.event_id
     WHERE se.user_id = ?
     ORDER BY e.start_time ASC`,
    [userId]
  );
  const calendar = buildCalendarFile(rows);
  res.set('Content-Type', 'text/calendar; charset=utf-8');
  res.set('Content-Disposition', 'attachment; filename=\"whatsthecraic-saved-events.ics\"');
  return res.send(calendar);
});

app.get('/v1/users/me/saved', requireAuth, async (req, res) => {
  const userId = req.user?.user_id;
  if (!userId) {
    return sendError(res, 401, 'unauthorized', 'Invalid user token');
  }
  const [rows] = await pool.query(
    `SELECT e.*
     FROM user_saved_events se
     JOIN events e ON e.id = se.event_id
     WHERE se.user_id = ?
     ORDER BY se.saved_at DESC`,
    [userId]
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

const CONTACT_TEMPLATES = [
  {
    id: 'dj-booking',
    label: 'DJ booking request',
    body: 'Hi {{recipient_name}},\n\nI’m {{organizer_name}} with {{organizer_org}}. We’re planning {{plan_name}} in {{city}} on {{date_range}} with a budget of {{budget_range}}. Would you be available?'
  },
  {
    id: 'venue-inquiry',
    label: 'Venue availability inquiry',
    body: 'Hi {{recipient_name}},\n\nI’m {{organizer_name}} and I’m looking to host {{plan_name}} in {{city}} on {{date_range}} for ~{{capacity}} guests. Are you available and what are your terms?'
  },
  {
    id: 'follow-up',
    label: 'Follow up',
    body: 'Hello {{recipient_name}},\n\nFollowing up on my previous message about {{plan_name}} in {{city}}. Happy to share more details if needed.'
  }
];

const renderTemplate = (template, vars) => {
  return template.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    const normalized = key.trim();
    return vars[normalized] ?? '';
  });
};

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

const fetchShortlistItems = async (planId) => {
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
  return rows.map(row => ({
    item_type: row.item_type,
    item_id: row.item_id,
    created_at: row.created_at,
    item: row.item_type === 'dj' ? djsById[row.item_id] : venuesById[row.item_id]
  }));
};

app.get('/v1/organizer/plans/:id/shortlist', requireAuth, requireOrganizer, async (req, res) => {
  const planId = parseIdParam(req.params.id);
  if (planId === null) {
    return sendError(res, 400, 'invalid_id', 'Invalid plan id');
  }
  const plan = await fetchPlanById(planId, req.user.user_id);
  if (!plan) {
    return sendError(res, 404, 'not_found', 'Plan not found');
  }
  const items = await fetchShortlistItems(planId);
  return res.json({ plan_id: planId, items });
});

app.get('/v1/organizer/plans/:id/shortlist/export', requireAuth, requireOrganizer, async (req, res) => {
  const planId = parseIdParam(req.params.id);
  if (planId === null) {
    return sendError(res, 400, 'invalid_id', 'Invalid plan id');
  }
  const plan = await fetchPlanById(planId, req.user.user_id);
  if (!plan) {
    return sendError(res, 404, 'not_found', 'Plan not found');
  }
  const format = (req.query.format || 'csv').toString().toLowerCase();
  const items = await fetchShortlistItems(planId);

  if (format === 'json') {
    return res.json({ plan_id: planId, items });
  }

  const header = ['item_type', 'item_id', 'name', 'city_or_address', 'genres', 'contact'];
  const lines = [header.join(',')];
  items.forEach(entry => {
    const item = entry.item || {};
    const name = entry.item_type === 'dj' ? item.dj_name : item.name;
    const cityOrAddress = entry.item_type === 'dj' ? item.city : item.address;
    const genres = entry.item_type === 'dj' ? item.genres : item.genreFocus;
    const contact = entry.item_type === 'dj'
      ? [item.email, item.instagram, item.phone].filter(Boolean).join(' | ')
      : item.notes || '';
    const row = [
      entry.item_type,
      entry.item_id,
      name || '',
      cityOrAddress || '',
      genres || '',
      contact || ''
    ].map(value => `"${String(value).replace(/"/g, '""')}"`);
    lines.push(row.join(','));
  });
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', `attachment; filename=\"shortlist-${planId}.csv\"`);
  return res.send(lines.join('\n'));
});

const organizerContactRequestLimiter = rateLimit({
  windowMs: parseIntOrDefault(process.env.ORGANIZER_CONTACT_REQUEST_WINDOW_MS, 60 * 60 * 1000),
  max: parseIntOrDefault(process.env.ORGANIZER_CONTACT_REQUEST_MAX, 10),
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.user?.user_id ?? req.ip),
  handler: (req, res) => sendError(res, 429, 'rate_limited', 'Too many contact requests. Try again later.'),
  skip: () => process.env.NODE_ENV === 'test'
});

app.get('/v1/organizer/contact-templates', requireAuth, requireOrganizer, async (req, res) => {
  return res.json({ templates: CONTACT_TEMPLATES });
});

app.post('/v1/organizer/contact-requests', requireAuth, requireOrganizer, organizerContactRequestLimiter, async (req, res) => {
  const schema = z.object({
    plan_id: z.coerce.number().int().positive().optional(),
    item_type: z.enum(['dj', 'venue']),
    item_id: z.coerce.number().int().positive(),
    message: z.string().optional(),
    template_id: z.string().optional(),
    template_vars: z.record(z.string()).optional()
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
  let message = parsed.data.message;
  if (!message && parsed.data.template_id) {
    const template = CONTACT_TEMPLATES.find(t => t.id === parsed.data.template_id);
    if (!template) {
      return sendError(res, 400, 'invalid_template', 'Template not found');
    }
    let organizerName = '';
    try {
      const [userRows] = await pool.query('SELECT name FROM users WHERE id = ?', [req.user.user_id]);
      organizerName = userRows.length ? userRows[0].name : '';
    } catch {
      organizerName = '';
    }
    let plan = null;
    if (planId) {
      plan = await fetchPlanById(planId, req.user.user_id);
    }
    const vars = {
      organizer_name: organizerName || 'Organizer',
      organizer_org: '',
      plan_name: plan?.name || 'your event',
      city: plan?.city || '',
      date_range: [plan?.start_date, plan?.end_date].filter(Boolean).join(' - '),
      budget_range: plan?.budget_min || plan?.budget_max
        ? `${plan?.budget_min || ''} - ${plan?.budget_max || ''}`.trim()
        : '',
      capacity: plan?.capacity ? String(plan.capacity) : '',
      recipient_name: '',
      item_type: parsed.data.item_type,
      item_id: String(parsed.data.item_id)
    };
    const mergedVars = { ...vars, ...(parsed.data.template_vars || {}) };
    message = renderTemplate(template.body, mergedVars);
  }
  if (!message || !message.trim()) {
    return sendError(res, 400, 'invalid_body', 'Message is required');
  }
  const [result] = await pool.execute(
    `INSERT INTO contact_requests (user_id, plan_id, item_type, item_id, message)
     VALUES (?, ?, ?, ?, ?)`,
    [req.user.user_id, planId, parsed.data.item_type, parsed.data.item_id, message]
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

app.post('/v1/events/:id/hide', requireAuth, async (req, res) => {
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
    `INSERT INTO user_hidden_events (user_id, event_id)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE hidden_at = CURRENT_TIMESTAMP`,
    [userId, eventId]
  );
  return res.status(200).json({ hidden: true, event_id: eventId });
});

app.delete('/v1/events/:id/hide', requireAuth, async (req, res) => {
  const eventId = parseIdParam(req.params.id);
  if (eventId === null) {
    return sendError(res, 400, 'invalid_id', 'Invalid event id');
  }
  const userId = req.user?.user_id;
  if (!userId) {
    return sendError(res, 401, 'unauthorized', 'Invalid user token');
  }
  await pool.execute(
    'DELETE FROM user_hidden_events WHERE user_id = ? AND event_id = ?',
    [userId, eventId]
  );
  return res.status(200).json({ hidden: false, event_id: eventId });
});

app.get('/v1/users/me/hidden', requireAuth, async (req, res) => {
  const userId = req.user?.user_id;
  if (!userId) {
    return sendError(res, 401, 'unauthorized', 'Invalid user token');
  }
  const [rows] = await pool.query(
    `SELECT e.*
     FROM user_hidden_events uh
     JOIN events e ON e.id = uh.event_id
     WHERE uh.user_id = ?
     ORDER BY uh.hidden_at DESC`,
    [userId]
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

if (INGESTION_ENABLED) {
  const runScheduledIngestion = async () => {
    const now = new Date();
    const start = new Date(now.getTime());
    const end = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    await triggerIngestion('ticketmaster', INGESTION_DEFAULT_CITY, start, end);
    await triggerIngestion('eventbrite', INGESTION_DEFAULT_CITY, start, end);
    await triggerIngestion('bandsintown', INGESTION_DEFAULT_CITY, start, end);
    await triggerIngestion('dice', INGESTION_DEFAULT_CITY, start, end);
  };
  runScheduledIngestion();
  setInterval(runScheduledIngestion, INGESTION_STALE_HOURS * 60 * 60 * 1000);
}

if (require.main === module) {
  app.listen(API_PORT, () => {
    console.log(`${SERVICE_NAME} listening on port ${API_PORT}`);
  });
}

module.exports = { app, pool };
