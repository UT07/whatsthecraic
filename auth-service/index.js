const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = process.env.NODE_ENV === 'test'
  ? {
    sign: () => 'test-token',
    verify: () => ({ user_id: 1, role: 'user' })
  }
  : require('jsonwebtoken');
const crypto = require('crypto');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');
const cors = require('cors');

const app = express();
const port = process.env.PORT || process.env.AUTH_SERVICE_PORT || 3001;
const SERVICE_NAME = 'auth-service';

// Middleware to parse JSON requests
app.use(express.json());
app.use(cors());

const metrics = {
  startTime: Date.now(),
  requests: 0,
  statusCodes: {},
  totalDurationMs: 0
};

const DB_HOST = process.env.DB_HOST || 'db';
const DB_PORT = process.env.DB_PORT || '3306';
const DB_USER = process.env.DB_USER || 'app';
const DB_PASSWORD = process.env.DB_PASSWORD || 'app';
const DB_NAME = process.env.DB_NAME || 'gigsdb';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI;
const SPOTIFY_SCOPES = process.env.SPOTIFY_SCOPES || 'user-top-read user-follow-read user-library-read user-read-email';
const SPOTIFY_PUBLIC_SYNC_TTL_MS = Number.parseInt(process.env.SPOTIFY_PUBLIC_SYNC_TTL_MS || `${6 * 60 * 60 * 1000}`, 10);
const SOUNDCLOUD_CLIENT_ID = process.env.SOUNDCLOUD_CLIENT_ID || null;
const SOUNDCLOUD_CLIENT_SECRET = process.env.SOUNDCLOUD_CLIENT_SECRET || null;
const SOUNDCLOUD_GENRE_TAG_LIMIT = Number.parseInt(process.env.SOUNDCLOUD_GENRE_TAG_LIMIT || '20', 10);
const SOUNDCLOUD_SYNC_CACHE_TTL_MS = Number.parseInt(process.env.SOUNDCLOUD_SYNC_CACHE_TTL_MS || `${20 * 60 * 1000}`, 10);
const SOUNDCLOUD_HTTP_CACHE_TTL_MS = Number.parseInt(process.env.SOUNDCLOUD_HTTP_CACHE_TTL_MS || `${10 * 60 * 1000}`, 10);
const SOUNDCLOUD_HTTP_STALE_MS = Number.parseInt(process.env.SOUNDCLOUD_HTTP_STALE_MS || `${5 * 60 * 1000}`, 10);
const SOUNDCLOUD_HTTP_BACKOFF_MS = Number.parseInt(process.env.SOUNDCLOUD_HTTP_BACKOFF_MS || '60000', 10);
const SOUNDCLOUD_HTTP_RETRY_ATTEMPTS = Number.parseInt(process.env.SOUNDCLOUD_HTTP_RETRY_ATTEMPTS || '2', 10);
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || null;
const YOUTUBE_CLIENT_ID = process.env.YOUTUBE_CLIENT_ID || null;
const YOUTUBE_CLIENT_SECRET = process.env.YOUTUBE_CLIENT_SECRET || null;
const YOUTUBE_REDIRECT_URI = process.env.YOUTUBE_REDIRECT_URI || null;
const YOUTUBE_SCOPES = process.env.YOUTUBE_SCOPES || 'https://www.googleapis.com/auth/youtube.readonly';
const YOUTUBE_SYNC_CACHE_TTL_MS = Number.parseInt(process.env.YOUTUBE_SYNC_CACHE_TTL_MS || `${20 * 60 * 1000}`, 10);
const YOUTUBE_HTTP_CACHE_TTL_MS = Number.parseInt(process.env.YOUTUBE_HTTP_CACHE_TTL_MS || `${15 * 60 * 1000}`, 10);
const YOUTUBE_HTTP_STALE_MS = Number.parseInt(process.env.YOUTUBE_HTTP_STALE_MS || `${5 * 60 * 1000}`, 10);
const YOUTUBE_HTTP_BACKOFF_MS = Number.parseInt(process.env.YOUTUBE_HTTP_BACKOFF_MS || '60000', 10);
const YOUTUBE_HTTP_RETRY_ATTEMPTS = Number.parseInt(process.env.YOUTUBE_HTTP_RETRY_ATTEMPTS || '2', 10);
const YOUTUBE_VIDEO_SCAN_LIMIT = Number.parseInt(process.env.YOUTUBE_VIDEO_SCAN_LIMIT || '35', 10);
const soundcloudHttpCache = new Map();
const soundcloudHttpInFlight = new Map();
const youtubeHttpCache = new Map();
const youtubeHttpInFlight = new Map();
let soundcloudAccessToken = null;
let soundcloudAccessTokenExpiresAt = 0;
let spotifyAppAccessToken = null;
let spotifyAppAccessTokenExpiresAt = 0;

const warnOnMissingEnv = () => {
  const missing = [];
  const warnings = [];
  if (!DB_HOST) missing.push('DB_HOST');
  if (!DB_USER) missing.push('DB_USER');
  if (!DB_PASSWORD) missing.push('DB_PASSWORD');
  if (!DB_NAME) missing.push('DB_NAME');
  if (!JWT_SECRET || JWT_SECRET === 'dev-secret') warnings.push('JWT_SECRET is using the default dev value');
  if (!SPOTIFY_CLIENT_ID) warnings.push('SPOTIFY_CLIENT_ID not set');
  if (!SPOTIFY_CLIENT_SECRET) warnings.push('SPOTIFY_CLIENT_SECRET not set');
  if (!SPOTIFY_REDIRECT_URI) warnings.push('SPOTIFY_REDIRECT_URI not set');
  if (SOUNDCLOUD_CLIENT_ID && !SOUNDCLOUD_CLIENT_SECRET) {
    warnings.push('SOUNDCLOUD_CLIENT_SECRET not set; SoundCloud enrichment quality/caching can be limited');
  }
  if (SOUNDCLOUD_CLIENT_SECRET && !SOUNDCLOUD_CLIENT_ID) {
    warnings.push('SOUNDCLOUD_CLIENT_ID not set');
  }
  if (!YOUTUBE_API_KEY) {
    warnings.push('YOUTUBE_API_KEY not set');
  }
  const youtubeOAuthEnv = [YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REDIRECT_URI].filter(Boolean).length;
  if (youtubeOAuthEnv > 0 && youtubeOAuthEnv < 3) {
    warnings.push('YouTube OAuth partially configured (need YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REDIRECT_URI)');
  }

  const messages = [];
  if (missing.length) messages.push(`Missing required env: ${missing.join(', ')}`);
  if (warnings.length) messages.push(...warnings);
  if (!messages.length) return;
  const message = `[${SERVICE_NAME}] ${messages.join(' | ')}`;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(message);
  }
  console.warn(message);
};

warnOnMissingEnv();

// Create a MySQL connection pool
const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  connectTimeout: 10000,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const DB_CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENOTFOUND',
  'EAI_AGAIN',
  'PROTOCOL_CONNECTION_LOST',
  'ER_ACCESS_DENIED_ERROR',
  'ER_BAD_DB_ERROR',
  'ER_CON_COUNT_ERROR'
]);

const DB_SCHEMA_ERROR_CODES = new Set([
  'ER_NO_SUCH_TABLE',
  'ER_BAD_FIELD_ERROR',
  'ER_PARSE_ERROR'
]);

const isDatabaseConnectionError = (err) => Boolean(err?.code && DB_CONNECTION_ERROR_CODES.has(err.code));
const isDatabaseSchemaError = (err) => Boolean(err?.code && DB_SCHEMA_ERROR_CODES.has(err.code));

const handleRouteError = (res, err, fallbackMessage = 'Server error') => {
  if (isDatabaseConnectionError(err)) {
    return sendError(res, 503, 'database_unavailable', 'Database is currently unavailable');
  }
  if (isDatabaseSchemaError(err)) {
    return sendError(res, 500, 'database_schema_error', 'Database schema is out of date');
  }
  if (typeof err?.status === 'number') {
    return sendError(res, err.status, 'internal_error', err.message || fallbackMessage);
  }
  return sendError(res, 500, 'internal_error', fallbackMessage);
};

const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

const ensureColumn = async (tableName, columnName, columnDefinition) => {
  try {
    const [rows] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\` LIKE ?`, [columnName]);
    if (rows.length === 0) {
      await pool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN \`${columnName}\` ${columnDefinition}`);
      console.log(`[${SERVICE_NAME}] Added ${tableName}.${columnName} column`);
    }
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return;
    }
    throw err;
  }
};

const ensureAuthSchema = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_soundcloud (
        user_id BIGINT NOT NULL PRIMARY KEY,
        soundcloud_user_id BIGINT NULL,
        username VARCHAR(255) NULL,
        permalink_url VARCHAR(512) NULL,
        avatar_url VARCHAR(1024) NULL,
        top_artists JSON DEFAULT NULL,
        top_genres JSON DEFAULT NULL,
        last_synced_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_youtube (
        user_id BIGINT NOT NULL PRIMARY KEY,
        channel_id VARCHAR(128) NULL,
        channel_title VARCHAR(255) NULL,
        channel_url VARCHAR(512) NULL,
        avatar_url VARCHAR(1024) NULL,
        access_token TEXT NULL,
        refresh_token TEXT NULL,
        token_type VARCHAR(64) NULL,
        scope TEXT NULL,
        expires_at DATETIME NULL DEFAULT NULL,
        connection_mode VARCHAR(32) NOT NULL DEFAULT 'manual',
        top_artists JSON DEFAULT NULL,
        top_genres JSON DEFAULT NULL,
        last_synced_at TIMESTAMP NULL DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await ensureColumn('users', 'role', "VARCHAR(32) DEFAULT 'user'");
    await ensureColumn('user_preferences', 'preferred_venues', 'JSON DEFAULT NULL');
    await ensureColumn('user_preferences', 'preferred_djs', 'JSON DEFAULT NULL');
    await ensureColumn('user_preferences', 'budget_max', 'DECIMAL(10,2) DEFAULT NULL');
    await ensureColumn('user_preferences', 'radius_km', 'INT DEFAULT NULL');
    await ensureColumn('user_preferences', 'night_preferences', 'JSON DEFAULT NULL');
    await ensureColumn('user_spotify', 'top_artists', 'JSON DEFAULT NULL');
    await ensureColumn('user_spotify', 'top_genres', 'JSON DEFAULT NULL');
    await ensureColumn('user_spotify', 'last_synced_at', 'TIMESTAMP NULL DEFAULT NULL');
    await ensureColumn('user_spotify', 'connection_mode', "VARCHAR(32) NOT NULL DEFAULT 'oauth'");
    await ensureColumn('user_spotify', 'display_name', 'VARCHAR(255) DEFAULT NULL');
    await ensureColumn('user_spotify', 'profile_url', 'VARCHAR(512) DEFAULT NULL');
    await ensureColumn('user_spotify', 'avatar_url', 'VARCHAR(1024) DEFAULT NULL');
    await ensureColumn('user_youtube', 'access_token', 'TEXT NULL');
    await ensureColumn('user_youtube', 'refresh_token', 'TEXT NULL');
    await ensureColumn('user_youtube', 'token_type', 'VARCHAR(64) DEFAULT NULL');
    await ensureColumn('user_youtube', 'scope', 'TEXT NULL');
    await ensureColumn('user_youtube', 'expires_at', 'DATETIME NULL DEFAULT NULL');
    await ensureColumn('user_youtube', 'connection_mode', "VARCHAR(32) NOT NULL DEFAULT 'manual'");
  } catch (err) {
    if (err.code !== 'ER_NO_SUCH_TABLE') {
      console.error('[auth-service] Schema check failed:', err.message);
    }
  }
};

if (process.env.NODE_ENV !== 'test') {
  void ensureAuthSchema();
}

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
    const sanitizeUrl = (value) => {
      try {
        const parsed = new URL(value, `http://${req.headers.host || 'localhost'}`);
        ['token', 'code', 'state'].forEach((param) => {
          if (parsed.searchParams.has(param)) {
            parsed.searchParams.set(param, 'REDACTED');
          }
        });
        return `${parsed.pathname}${parsed.search}`;
      } catch {
        return value;
      }
    };
    const safeUrl = sanitizeUrl(req.originalUrl || '');
    console.log(JSON.stringify({
      level: 'info',
      service: SERVICE_NAME,
      request_id: requestId,
      method: req.method,
      path: safeUrl,
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

if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex').slice(0, 24);
const resolveIpKey = (ip) => (typeof rateLimit.ipKeyGenerator === 'function' ? rateLimit.ipKeyGenerator(ip) : (ip || 'unknown'));
const rateLimitKey = (req) => {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return `token:${hashToken(authHeader.slice(7))}`;
  }
  return `ip:${resolveIpKey(req.ip || req.socket?.remoteAddress)}`;
};

const rateLimiter = rateLimit({
  windowMs: parseIntOrDefault(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
  max: parseIntOrDefault(process.env.RATE_LIMIT_MAX, 240),
  keyGenerator: rateLimitKey,
  skip: (req) => req.path === '/health' || req.path === '/metrics',
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

const getUserIdFromToken = (token) => {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return payload?.user_id || null;
  } catch {
    return null;
  }
};

const spotifyAppConfigured = () => Boolean(SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET);
const spotifyConfigured = () => spotifyAppConfigured() && Boolean(SPOTIFY_REDIRECT_URI);

const spotifyMissingConfig = () => {
  const missing = [];
  if (!SPOTIFY_CLIENT_ID) missing.push('SPOTIFY_CLIENT_ID');
  if (!SPOTIFY_CLIENT_SECRET) missing.push('SPOTIFY_CLIENT_SECRET');
  if (!SPOTIFY_REDIRECT_URI) missing.push('SPOTIFY_REDIRECT_URI');
  return missing;
};

const soundcloudConfigured = () => Boolean(SOUNDCLOUD_CLIENT_ID && SOUNDCLOUD_CLIENT_SECRET);
const youtubeApiConfigured = () => Boolean(YOUTUBE_API_KEY);
const youtubeOAuthConfigured = () => Boolean(YOUTUBE_CLIENT_ID && YOUTUBE_CLIENT_SECRET && YOUTUBE_REDIRECT_URI);
const youtubeConfigured = () => youtubeApiConfigured() || youtubeOAuthConfigured();

const youtubeOAuthMissingConfig = () => {
  const missing = [];
  if (!YOUTUBE_CLIENT_ID) missing.push('YOUTUBE_CLIENT_ID');
  if (!YOUTUBE_CLIENT_SECRET) missing.push('YOUTUBE_CLIENT_SECRET');
  if (!YOUTUBE_REDIRECT_URI) missing.push('YOUTUBE_REDIRECT_URI');
  return missing;
};

const normalizeSoundcloudToken = (value) => (value || '')
  .toString()
  .toLowerCase()
  .trim();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseRetryAfterMs = (value) => {
  if (!value) return null;
  if (/^\d+$/.test(String(value).trim())) {
    return Math.max(Number.parseInt(value, 10) * 1000, 0);
  }
  const dateMs = Date.parse(value);
  if (Number.isNaN(dateMs)) return null;
  return Math.max(dateMs - Date.now(), 0);
};

const isRetryableSoundcloudError = (status) => status === 429 || status >= 500;

const cleanupSoundcloudHttpCache = () => {
  if (soundcloudHttpCache.size <= 1000) return;
  const now = Date.now();
  for (const [key, value] of soundcloudHttpCache.entries()) {
    if ((value?.staleUntil || 0) <= now) {
      soundcloudHttpCache.delete(key);
    }
  }
};

const normalizeSoundcloudProfileInput = (value) => {
  const input = (value || '').toString().trim();
  if (!input) return '';
  if (input.includes('soundcloud.com/')) {
    return input.startsWith('http://') || input.startsWith('https://')
      ? input
      : `https://${input}`;
  }
  if (input.startsWith('http://') || input.startsWith('https://')) {
    return input;
  }
  return input.replace(/^@/, '');
};

const buildSoundcloudFallbackProfile = (profileInput) => {
  const normalizedInput = normalizeSoundcloudProfileInput(profileInput);
  if (!normalizedInput) {
    const error = new Error('SoundCloud profile URL or username is required');
    error.status = 400;
    throw error;
  }

  let username = normalizedInput.replace(/^@/, '');
  let permalinkUrl = null;

  if (normalizedInput.startsWith('http://') || normalizedInput.startsWith('https://')) {
    try {
      const parsed = new URL(normalizedInput);
      const parts = parsed.pathname.split('/').filter(Boolean);
      username = parts[0] || username;
      permalinkUrl = `https://soundcloud.com/${username}`;
    } catch {
      permalinkUrl = normalizedInput;
    }
  } else {
    permalinkUrl = `https://soundcloud.com/${username}`;
  }

  const fallbackName = normalizeSoundcloudToken(username);
  return {
    username,
    permalink_url: permalinkUrl,
    avatar_url: null,
    top_artists: fallbackName ? [{ name: fallbackName, count: 1 }] : [],
    top_genres: [],
    degraded: true
  };
};

const getSoundcloudAccessToken = async () => {
  if (!soundcloudConfigured()) {
    const error = new Error('SoundCloud is not configured');
    error.status = 500;
    throw error;
  }

  if (soundcloudAccessToken && Date.now() < soundcloudAccessTokenExpiresAt - 60000) {
    return soundcloudAccessToken;
  }

  let response;
  try {
    response = await fetch('https://secure.soundcloud.com/oauth/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${SOUNDCLOUD_CLIENT_ID}:${SOUNDCLOUD_CLIENT_SECRET}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json'
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials'
      }).toString()
    });
  } catch (err) {
    const error = new Error(`SoundCloud auth request failed: ${err.message}`);
    error.status = 502;
    throw error;
  }

  const text = await response.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!response.ok || !data.access_token) {
    const message = data.error_description || data.error || data.error_message || 'Failed to authenticate with SoundCloud';
    const error = new Error(message);
    error.status = response.status || 500;
    error.data = data;
    throw error;
  }

  soundcloudAccessToken = data.access_token;
  soundcloudAccessTokenExpiresAt = Date.now() + (Number(data.expires_in || 3600) * 1000);
  return soundcloudAccessToken;
};

const fetchSoundcloudJson = async (url) => {
  if (!soundcloudConfigured()) {
    const error = new Error('SoundCloud is not configured');
    error.status = 500;
    throw error;
  }

  const parsed = new URL(url);
  if (parsed.hostname === 'api-v2.soundcloud.com') {
    parsed.hostname = 'api.soundcloud.com';
  }
  const requestUrl = parsed.toString();
  const now = Date.now();
  const cached = soundcloudHttpCache.get(requestUrl);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  if (soundcloudHttpInFlight.has(requestUrl)) {
    return soundcloudHttpInFlight.get(requestUrl);
  }

  const task = (async () => {
    let attempt = 0;
    while (true) {
      const accessToken = await getSoundcloudAccessToken();
      const res = await fetch(requestUrl, {
        headers: {
          Accept: 'application/json',
          Authorization: `OAuth ${accessToken}`
        }
      });
      const text = await res.text();
      let data = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text };
        }
      }

      if (res.ok) {
        const createdAt = Date.now();
        soundcloudHttpCache.set(requestUrl, {
          value: data,
          expiresAt: createdAt + SOUNDCLOUD_HTTP_CACHE_TTL_MS,
          staleUntil: createdAt + SOUNDCLOUD_HTTP_CACHE_TTL_MS + SOUNDCLOUD_HTTP_STALE_MS
        });
        cleanupSoundcloudHttpCache();
        return data;
      }

      const status = Number(res.status || 0);
      const message = data.error_message || data.error?.message || data.error || 'SoundCloud API error';
      if (status === 401 && attempt < SOUNDCLOUD_HTTP_RETRY_ATTEMPTS) {
        soundcloudAccessToken = null;
        soundcloudAccessTokenExpiresAt = 0;
        attempt += 1;
        continue;
      }
      if (isRetryableSoundcloudError(status) && attempt < SOUNDCLOUD_HTTP_RETRY_ATTEMPTS) {
        const retryAfter = parseRetryAfterMs(res.headers.get('retry-after'));
        const backoff = retryAfter ?? Math.min(SOUNDCLOUD_HTTP_BACKOFF_MS * (attempt + 1), 120000);
        const jitter = Math.floor(Math.random() * 250);
        await sleep(backoff + jitter);
        attempt += 1;
        continue;
      }

      const error = new Error(message);
      error.status = status || 500;
      error.data = data;
      throw error;
    }
  })()
    .catch((err) => {
      const stale = soundcloudHttpCache.get(requestUrl);
      if (stale && stale.staleUntil > Date.now()) {
        console.warn(`[auth-service] serving stale SoundCloud cache for ${requestUrl}`);
        return stale.value;
      }
      throw err;
    })
    .finally(() => {
      soundcloudHttpInFlight.delete(requestUrl);
    });

  soundcloudHttpInFlight.set(requestUrl, task);
  return task;
};

const resolveSoundcloudUser = async (profileInput) => {
  const normalizedInput = normalizeSoundcloudProfileInput(profileInput);
  if (!normalizedInput) {
    const error = new Error('SoundCloud profile URL or username is required');
    error.status = 400;
    throw error;
  }

  // Resolve direct SoundCloud profile URL first.
  if (normalizedInput.startsWith('http://') || normalizedInput.startsWith('https://')) {
    const resolved = await fetchSoundcloudJson(`https://api.soundcloud.com/resolve?url=${encodeURIComponent(normalizedInput)}`);
    if ((resolved?.kind || '') === 'user' || resolved?.username) {
      return resolved;
    }
    const error = new Error('Provided SoundCloud URL did not resolve to a user profile');
    error.status = 400;
    throw error;
  }

  // Resolve username by search.
  const search = await fetchSoundcloudJson(`https://api.soundcloud.com/users?q=${encodeURIComponent(normalizedInput)}&limit=20`);
  const users = Array.isArray(search)
    ? search
    : (Array.isArray(search?.collection) ? search.collection : []);
  if (!users.length) {
    const error = new Error('No SoundCloud user found for the provided profile');
    error.status = 404;
    throw error;
  }

  const target = normalizeSoundcloudToken(normalizedInput);
  const best = users.find((user) => {
    const usernameToken = normalizeSoundcloudToken(user?.username);
    const permalinkToken = normalizeSoundcloudToken(user?.permalink);
    const fullNameToken = normalizeSoundcloudToken(user?.full_name);
    return usernameToken === target || permalinkToken === target || fullNameToken === target;
  }) || users[0];
  return best;
};

const splitSoundcloudTags = (value) => {
  if (!value) return [];
  const raw = value
    .toString()
    .replace(/"/g, ' ')
    .replace(/#/g, ' ')
    .replace(/,/g, ' ')
    .replace(/\|/g, ' ');
  return raw
    .split(/\s+/)
    .map(normalizeSoundcloudToken)
    .filter((token) => token.length >= 3 && token.length <= 40);
};

const computeSoundcloudTopGenres = (tracks) => {
  const counts = new Map();
  (tracks || []).forEach((track) => {
    const candidates = new Set([
      normalizeSoundcloudToken(track?.genre),
      ...splitSoundcloudTags(track?.tag_list)
    ]);
    candidates.forEach((genre) => {
      if (!genre) return;
      counts.set(genre, (counts.get(genre) || 0) + 1);
    });
  });
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, SOUNDCLOUD_GENRE_TAG_LIMIT)
    .map(([genre, count]) => ({ genre, count }));
};

const computeSoundcloudTopArtists = (tracks, fallbackName) => {
  const counts = new Map();
  (tracks || []).forEach((track) => {
    const candidates = [
      track?.publisher_metadata?.artist,
      track?.user?.username,
      track?.user?.full_name
    ].map(normalizeSoundcloudToken).filter(Boolean);
    candidates.forEach((artist) => {
      counts.set(artist, (counts.get(artist) || 0) + 1);
    });
  });

  if (counts.size === 0 && fallbackName) {
    const fallback = normalizeSoundcloudToken(fallbackName);
    if (fallback) counts.set(fallback, 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, count]) => ({ name, count }));
};

const getSoundcloudProfile = async (userId) => {
  try {
    const [rows] = await pool.query(
      `SELECT user_id, soundcloud_user_id, username, permalink_url, avatar_url,
              top_artists, top_genres, last_synced_at
       FROM user_soundcloud
       WHERE user_id = ?`,
      [userId]
    );
    return rows[0] || null;
  } catch (err) {
    if (err?.code === 'ER_NO_SUCH_TABLE') {
      return null;
    }
    throw err;
  }
};

const upsertSoundcloudProfile = async ({
  userId,
  soundcloudUserId,
  username,
  permalinkUrl,
  avatarUrl,
  topArtists,
  topGenres
}) => {
  const params = [
    userId,
    soundcloudUserId || null,
    username || null,
    permalinkUrl || null,
    avatarUrl || null,
    JSON.stringify(topArtists || []),
    JSON.stringify(topGenres || [])
  ];

  const statement = `INSERT INTO user_soundcloud
    (user_id, soundcloud_user_id, username, permalink_url, avatar_url, top_artists, top_genres, last_synced_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
   ON DUPLICATE KEY UPDATE
     soundcloud_user_id = VALUES(soundcloud_user_id),
     username = VALUES(username),
     permalink_url = VALUES(permalink_url),
     avatar_url = VALUES(avatar_url),
     top_artists = VALUES(top_artists),
     top_genres = VALUES(top_genres),
     last_synced_at = CURRENT_TIMESTAMP`;

  try {
    await pool.query(statement, params);
  } catch (err) {
    if (err?.code !== 'ER_NO_SUCH_TABLE') throw err;
    await ensureAuthSchema();
    await pool.query(statement, params);
  }
};

const parseJsonField = (value, fallback = []) => {
  if (!value) return fallback;
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const serializeSoundcloudProfile = (row, overrides = {}) => ({
  synced: true,
  username: overrides.username ?? row?.username ?? null,
  permalink_url: overrides.permalink_url ?? row?.permalink_url ?? null,
  avatar_url: overrides.avatar_url ?? row?.avatar_url ?? null,
  top_artists: overrides.top_artists ?? parseJsonField(row?.top_artists, []),
  top_genres: overrides.top_genres ?? parseJsonField(row?.top_genres, [])
});

const isSoundcloudSyncFresh = (value) => {
  if (!value || SOUNDCLOUD_SYNC_CACHE_TTL_MS <= 0) return false;
  const syncedAt = new Date(value).getTime();
  if (Number.isNaN(syncedAt)) return false;
  return (Date.now() - syncedAt) <= SOUNDCLOUD_SYNC_CACHE_TTL_MS;
};

const isHttpUrl = (value) => value.startsWith('http://') || value.startsWith('https://');

const extractSoundcloudIdentity = (value) => {
  const normalized = normalizeSoundcloudProfileInput(value);
  if (!normalized) return '';
  if (isHttpUrl(normalized)) {
    try {
      const parsed = new URL(normalized);
      const path = parsed.pathname.split('/').filter(Boolean)[0] || '';
      return normalizeSoundcloudToken(path);
    } catch {
      return normalizeSoundcloudToken(normalized);
    }
  }
  return normalizeSoundcloudToken(normalized);
};

const isSameSoundcloudProfile = (row, profileInput) => {
  const incoming = extractSoundcloudIdentity(profileInput);
  if (!incoming) return false;
  const rowUsername = normalizeSoundcloudToken(row?.username);
  const rowPermalink = extractSoundcloudIdentity(row?.permalink_url);
  return incoming === rowUsername || incoming === rowPermalink;
};

const getSoundcloudUserLookupId = (user) => {
  const raw = user?.id ?? user?.urn;
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  if (!text) return null;
  if (text.includes(':')) {
    const parts = text.split(':').filter(Boolean);
    return parts.length ? parts[parts.length - 1] : null;
  }
  return text;
};

const getSoundcloudPersistedUserId = (user) => {
  const lookupId = getSoundcloudUserLookupId(user);
  if (!lookupId) return null;
  return /^\d+$/.test(lookupId) ? lookupId : null;
};

const getSoundcloudCollection = (response) => {
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.collection)) return response.collection;
  return [];
};

const toSoundcloudTrack = (item) => {
  if (!item || typeof item !== 'object') return null;
  if (item.track && typeof item.track === 'object') return item.track;
  if (item.sound && typeof item.sound === 'object') return item.sound;
  if (item.kind === 'track' || item.type === 'track' || item.streamable !== undefined || item.title) {
    return item;
  }
  return null;
};

const extractTracksFromSoundcloudLikes = (response) => {
  const tracks = [];
  getSoundcloudCollection(response).forEach((entry) => {
    const track = toSoundcloudTrack(entry);
    if (track) tracks.push(track);
  });
  return tracks;
};

const mergeSoundcloudTracks = (...trackLists) => {
  const byKey = new Map();
  trackLists.forEach((list) => {
    (Array.isArray(list) ? list : []).forEach((track) => {
      const idKey = (track?.id ?? track?.urn ?? '').toString().trim();
      const permalinkKey = normalizeSoundcloudToken(track?.permalink_url);
      const titleKey = normalizeSoundcloudToken(track?.title);
      const userKey = normalizeSoundcloudToken(track?.user?.username || track?.publisher_metadata?.artist);
      const fallbackKey = `${titleKey}|${userKey}`;
      const key = idKey || permalinkKey || fallbackKey;
      if (!key || byKey.has(key)) return;
      byKey.set(key, track);
    });
  });
  return Array.from(byKey.values());
};

const syncSoundcloudProfile = async (userId, profileInput = null) => {
  const normalizedInput = normalizeSoundcloudProfileInput(profileInput);
  const existing = await getSoundcloudProfile(userId);
  const buildDegradedFromExisting = (reason = 'soundcloud_sync_degraded', overrides = {}) => {
    if (!existing) return null;
    return {
      ...serializeSoundcloudProfile(existing, overrides),
      cached: true,
      degraded: true,
      reason
    };
  };

  if (!soundcloudConfigured()) {
    const degraded = buildDegradedFromExisting('soundcloud_not_fully_configured');
    if (degraded) return degraded;
    if (!normalizedInput) {
      const error = new Error('SoundCloud is not configured');
      error.status = 500;
      throw error;
    }
    const fallbackProfile = buildSoundcloudFallbackProfile(normalizedInput);
    await upsertSoundcloudProfile({
      userId,
      soundcloudUserId: null,
      username: fallbackProfile.username,
      permalinkUrl: fallbackProfile.permalink_url,
      avatarUrl: fallbackProfile.avatar_url,
      topArtists: fallbackProfile.top_artists,
      topGenres: fallbackProfile.top_genres
    });
    return {
      synced: true,
      ...fallbackProfile
    };
  }

  if (existing && normalizedInput && isSameSoundcloudProfile(existing, normalizedInput) && isSoundcloudSyncFresh(existing.last_synced_at)) {
    return {
      ...serializeSoundcloudProfile(existing),
      cached: true
    };
  }

  if (existing && !normalizedInput && isSoundcloudSyncFresh(existing.last_synced_at)) {
    return {
      ...serializeSoundcloudProfile(existing),
      cached: true
    };
  }

  let user = null;
  if (normalizedInput) {
    try {
      user = await resolveSoundcloudUser(normalizedInput);
    } catch (err) {
      const status = Number(err?.status || 0);
      if ([401, 403, 404, 429].includes(status)) {
        if (existing && isSameSoundcloudProfile(existing, normalizedInput)) {
          const degraded = buildDegradedFromExisting('soundcloud_profile_cached');
          if (degraded) return degraded;
        }
        const fallbackProfile = buildSoundcloudFallbackProfile(normalizedInput);
        await upsertSoundcloudProfile({
          userId,
          soundcloudUserId: null,
          username: fallbackProfile.username,
          permalinkUrl: fallbackProfile.permalink_url,
          avatarUrl: fallbackProfile.avatar_url,
          topArtists: fallbackProfile.top_artists,
          topGenres: fallbackProfile.top_genres
        });
        return {
          synced: true,
          ...fallbackProfile
        };
      }
      if (existing) {
        const degraded = buildDegradedFromExisting('soundcloud_upstream_unavailable');
        if (degraded) return degraded;
      }
      throw err;
    }
  } else {
    if (!existing) {
      return { synced: false, reason: 'not_linked' };
    }
    try {
      user = await resolveSoundcloudUser(existing.permalink_url || existing.username);
    } catch (err) {
      const degraded = buildDegradedFromExisting('soundcloud_upstream_unavailable');
      if (degraded) return degraded;
      throw err;
    }
  }

  const lookupId = getSoundcloudUserLookupId(user);
  if (!lookupId) {
    const degraded = buildDegradedFromExisting('soundcloud_lookup_missing');
    if (degraded) return degraded;
    const error = new Error('Could not resolve SoundCloud user id');
    error.status = 502;
    throw error;
  }

  const encodedId = encodeURIComponent(lookupId);
  const [tracksResult, favoritesResult] = await Promise.allSettled([
    fetchSoundcloudJson(`https://api.soundcloud.com/users/${encodedId}/tracks?limit=200`),
    fetchSoundcloudJson(`https://api.soundcloud.com/users/${encodedId}/favorites?limit=200`)
  ]);

  const ownTracks = tracksResult.status === 'fulfilled' ? getSoundcloudCollection(tracksResult.value) : [];
  const likedTracks = favoritesResult.status === 'fulfilled'
    ? extractTracksFromSoundcloudLikes(favoritesResult.value)
    : [];
  const mergedTracks = mergeSoundcloudTracks(ownTracks, likedTracks);

  if (mergedTracks.length === 0 && existing) {
    const degraded = buildDegradedFromExisting('soundcloud_tracks_unavailable');
    if (degraded) return degraded;
  }

  const topGenres = computeSoundcloudTopGenres(mergedTracks);
  const topArtists = computeSoundcloudTopArtists(mergedTracks, user.username || user.full_name);

  await upsertSoundcloudProfile({
    userId,
    soundcloudUserId: getSoundcloudPersistedUserId(user),
    username: user.username || user.permalink || null,
    permalinkUrl: user.permalink_url || null,
    avatarUrl: user.avatar_url || null,
    topArtists,
    topGenres
  });

  return {
    synced: true,
    username: user.username || null,
    permalink_url: user.permalink_url || null,
    avatar_url: user.avatar_url || null,
    top_artists: topArtists,
    top_genres: topGenres
  };
};

const normalizeYoutubeToken = (value) => (value || '')
  .toString()
  .toLowerCase()
  .trim();

const normalizeYoutubeProfileInput = (value) => (value || '').toString().trim();

const isRetryableYoutubeError = (status) => status === 429 || status >= 500;

const cleanupYoutubeHttpCache = () => {
  if (youtubeHttpCache.size <= 1000) return;
  const now = Date.now();
  for (const [key, value] of youtubeHttpCache.entries()) {
    if ((value?.staleUntil || 0) <= now) {
      youtubeHttpCache.delete(key);
    }
  }
};

const fetchYoutubeJson = async (url) => {
  if (!youtubeApiConfigured()) {
    const error = new Error('YouTube API key is not configured');
    error.status = 500;
    throw error;
  }

  const parsed = new URL(url);
  parsed.searchParams.set('key', YOUTUBE_API_KEY);
  const requestUrl = parsed.toString();
  const now = Date.now();
  const cached = youtubeHttpCache.get(requestUrl);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  if (youtubeHttpInFlight.has(requestUrl)) {
    return youtubeHttpInFlight.get(requestUrl);
  }

  const task = (async () => {
    let attempt = 0;
    while (true) {
      const res = await fetch(requestUrl, {
        headers: {
          Accept: 'application/json'
        }
      });
      const text = await res.text();
      let data = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { raw: text };
        }
      }

      if (res.ok) {
        const createdAt = Date.now();
        youtubeHttpCache.set(requestUrl, {
          value: data,
          expiresAt: createdAt + YOUTUBE_HTTP_CACHE_TTL_MS,
          staleUntil: createdAt + YOUTUBE_HTTP_CACHE_TTL_MS + YOUTUBE_HTTP_STALE_MS
        });
        cleanupYoutubeHttpCache();
        return data;
      }

      const status = Number(res.status || 0);
      const message = data?.error?.message || data?.error_description || data?.error || 'YouTube API error';
      if (isRetryableYoutubeError(status) && attempt < YOUTUBE_HTTP_RETRY_ATTEMPTS) {
        const retryAfter = parseRetryAfterMs(res.headers.get('retry-after'));
        const backoff = retryAfter ?? Math.min(YOUTUBE_HTTP_BACKOFF_MS * (attempt + 1), 120000);
        const jitter = Math.floor(Math.random() * 250);
        await sleep(backoff + jitter);
        attempt += 1;
        continue;
      }

      const error = new Error(message);
      error.status = status || 500;
      error.data = data;
      throw error;
    }
  })()
    .catch((err) => {
      const stale = youtubeHttpCache.get(requestUrl);
      if (stale && stale.staleUntil > Date.now()) {
        console.warn(`[auth-service] serving stale YouTube cache for ${requestUrl}`);
        return stale.value;
      }
      throw err;
    })
    .finally(() => {
      youtubeHttpInFlight.delete(requestUrl);
    });

  youtubeHttpInFlight.set(requestUrl, task);
  return task;
};

const extractYoutubeProfileHint = (profileInput) => {
  const input = normalizeYoutubeProfileInput(profileInput);
  if (!input) return { type: null, value: null };

  if (input.startsWith('http://') || input.startsWith('https://')) {
    try {
      const parsed = new URL(input);
      const host = parsed.hostname.toLowerCase();
      if (host.endsWith('youtube.com') || host.endsWith('youtu.be')) {
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (parts[0] === 'channel' && parts[1]) {
          return { type: 'channel_id', value: parts[1] };
        }
        if (parts[0] && parts[0].startsWith('@')) {
          return { type: 'handle', value: parts[0].slice(1) };
        }
        if ((parts[0] === 'user' || parts[0] === 'c') && parts[1]) {
          return { type: 'query', value: parts[1] };
        }
      }
    } catch {
      return { type: 'query', value: input };
    }
    return { type: 'query', value: input };
  }

  if (input.startsWith('@')) {
    return { type: 'handle', value: input.slice(1) };
  }

  if (/^UC[a-zA-Z0-9_-]{10,}$/.test(input)) {
    return { type: 'channel_id', value: input };
  }

  return { type: 'query', value: input };
};

const buildYoutubeChannelUrl = (channelId) => channelId
  ? `https://www.youtube.com/channel/${encodeURIComponent(channelId)}`
  : null;

const scoreYoutubeChannelCandidate = (channel, hint) => {
  const id = normalizeYoutubeToken(channel?.id);
  const title = normalizeYoutubeToken(channel?.snippet?.title);
  const customUrl = normalizeYoutubeToken(channel?.snippet?.customUrl).replace(/^@/, '');
  const hintValue = normalizeYoutubeToken(hint?.value).replace(/^@/, '');
  if (!hintValue) return 0;
  let score = 0;
  if (hint?.type === 'channel_id' && id === hintValue) score += 100;
  if (customUrl && (customUrl === hintValue || customUrl.includes(hintValue))) score += 80;
  if (title && (title === hintValue || title.includes(hintValue) || hintValue.includes(title))) score += 40;
  return score;
};

const resolveYoutubeChannel = async (profileInput) => {
  const hint = extractYoutubeProfileHint(profileInput);
  if (!hint?.value) {
    const error = new Error('YouTube channel URL, handle, or channel id is required');
    error.status = 400;
    throw error;
  }

  let channels = [];
  if (hint.type === 'channel_id') {
    const response = await fetchYoutubeJson(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${encodeURIComponent(hint.value)}&maxResults=1`
    );
    channels = Array.isArray(response?.items) ? response.items : [];
  } else {
    const query = hint.type === 'handle' ? `@${hint.value}` : hint.value;
    const search = await fetchYoutubeJson(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&maxResults=8`
    );
    const channelIds = Array.from(new Set(
      (Array.isArray(search?.items) ? search.items : [])
        .map((item) => item?.snippet?.channelId || item?.id?.channelId || null)
        .filter(Boolean)
    ));
    if (channelIds.length > 0) {
      const response = await fetchYoutubeJson(
        `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelIds.map(encodeURIComponent).join(',')}&maxResults=${Math.min(channelIds.length, 8)}`
      );
      channels = Array.isArray(response?.items) ? response.items : [];
    }
  }

  if (!channels.length) {
    const error = new Error('No YouTube channel found for the provided profile');
    error.status = 404;
    throw error;
  }

  const ranked = channels
    .map((channel) => ({ channel, score: scoreYoutubeChannelCandidate(channel, hint) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0]?.channel || channels[0];

  const channelId = best?.id || best?.snippet?.channelId || null;
  if (!channelId) {
    const error = new Error('Could not resolve YouTube channel id');
    error.status = 502;
    throw error;
  }

  return {
    channel_id: channelId,
    channel_title: best?.snippet?.title || hint.value,
    channel_url: buildYoutubeChannelUrl(channelId),
    avatar_url: best?.snippet?.thumbnails?.high?.url
      || best?.snippet?.thumbnails?.medium?.url
      || best?.snippet?.thumbnails?.default?.url
      || null
  };
};

const fetchYoutubeVideosForChannel = async (channelId) => {
  if (!channelId) return [];
  const maxResults = Math.max(5, Math.min(YOUTUBE_VIDEO_SCAN_LIMIT, 50));
  const search = await fetchYoutubeJson(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&order=date&channelId=${encodeURIComponent(channelId)}&maxResults=${maxResults}`
  );
  const items = Array.isArray(search?.items) ? search.items : [];
  const videoIds = Array.from(new Set(items
    .map((item) => item?.id?.videoId || null)
    .filter(Boolean)));

  if (videoIds.length === 0) return [];

  const detailsById = new Map();
  for (let index = 0; index < videoIds.length; index += 50) {
    const chunk = videoIds.slice(index, index + 50);
    if (!chunk.length) continue;
    try {
      const details = await fetchYoutubeJson(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,topicDetails&id=${chunk.map(encodeURIComponent).join(',')}&maxResults=${chunk.length}`
      );
      (details?.items || []).forEach((item) => {
        const id = item?.id;
        if (!id) return;
        detailsById.set(id, item);
      });
    } catch (err) {
      console.warn('[auth-service] YouTube video details fetch failed:', err.message);
    }
  }

  return videoIds.map((videoId) => {
    const item = detailsById.get(videoId)
      || items.find((entry) => (entry?.id?.videoId || '') === videoId)
      || {};
    const snippet = item?.snippet || {};
    return {
      id: videoId,
      title: snippet?.title || '',
      description: snippet?.description || '',
      tags: Array.isArray(snippet?.tags) ? snippet.tags : [],
      topic_categories: Array.isArray(item?.topicDetails?.topicCategories) ? item.topicDetails.topicCategories : []
    };
  });
};

const YOUTUBE_GENRE_KEYWORDS = {
  techno: ['techno', 'hard techno', 'melodic techno', 'acid techno', 'industrial techno'],
  house: ['house', 'deep house', 'tech house', 'afro house', 'progressive house'],
  trance: ['trance', 'psytrance', 'uplifting trance'],
  dnb: ['drum and bass', 'dnb', 'liquid dnb', 'neurofunk'],
  dubstep: ['dubstep', 'brostep', 'riddim'],
  garage: ['garage', 'uk garage', '2-step'],
  disco: ['disco', 'nu disco'],
  hiphop: ['hip hop', 'hip-hop', 'rap', 'trap', 'drill', 'grime'],
  pop: ['pop', 'electropop', 'synthpop'],
  rock: ['rock', 'indie rock', 'alt rock', 'punk'],
  jazz: ['jazz', 'nu jazz', 'jazz fusion'],
  ambient: ['ambient', 'downtempo', 'chillout', 'lofi'],
  edm: ['edm', 'electronic', 'dance music', 'festival set']
};

const normalizeYoutubeTextBlob = (value) => normalizeYoutubeToken(value)
  .replace(/[_-]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const computeYoutubeTopGenres = (videos = []) => {
  const counts = new Map();
  (Array.isArray(videos) ? videos : []).forEach((video) => {
    const blob = normalizeYoutubeTextBlob([
      video?.title || '',
      video?.description || '',
      ...(Array.isArray(video?.tags) ? video.tags : []),
      ...(Array.isArray(video?.topic_categories) ? video.topic_categories : [])
    ].join(' '));
    if (!blob) return;
    Object.entries(YOUTUBE_GENRE_KEYWORDS).forEach(([genre, keywords]) => {
      const hasMatch = keywords.some((keyword) => {
        const token = normalizeYoutubeToken(keyword);
        return token && blob.includes(token);
      });
      if (hasMatch) {
        counts.set(genre, (counts.get(genre) || 0) + 1);
      }
    });
  });

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([genre, count]) => ({ genre, count }));
};

const computeYoutubeTopArtists = (videos = [], fallbackName = '') => {
  const counts = new Map();
  const artistStopTokens = ['official', 'video', 'live', 'set', 'mix', 'session', 'radio', 'episode', 'podcast', 'premiere'];

  const maybeAddArtist = (value) => {
    const candidate = (value || '').toString().trim();
    if (!candidate) return;
    const normalized = normalizeYoutubeToken(candidate)
      .replace(/[^\w\s.'-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!normalized || normalized.length < 2 || normalized.length > 60) return;
    if (artistStopTokens.some((token) => normalized === token)) return;
    if (artistStopTokens.some((token) => normalized.endsWith(` ${token}`))) return;
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  };

  (Array.isArray(videos) ? videos : []).forEach((video) => {
    const title = (video?.title || '').toString();
    if (!title) return;
    const byMatch = title.match(/\bby\s+([^|[\]()]{2,64})/i);
    if (byMatch?.[1]) maybeAddArtist(byMatch[1]);
    const splitCandidates = title.split(/[-|:]/).map((segment) => segment.trim()).filter(Boolean);
    if (splitCandidates[0]) maybeAddArtist(splitCandidates[0]);
    if (splitCandidates[1] && /live|set|mix|session|radio|podcast/i.test(splitCandidates[0])) {
      maybeAddArtist(splitCandidates[1]);
    }
  });

  if (counts.size === 0 && fallbackName) {
    maybeAddArtist(fallbackName);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, count]) => ({ name, count }));
};

const buildYoutubeFallbackProfile = (profileInput) => {
  const hint = extractYoutubeProfileHint(profileInput);
  if (!hint?.value) {
    const error = new Error('YouTube channel URL, handle, or channel id is required');
    error.status = 400;
    throw error;
  }

  const raw = (hint.value || '').toString().trim();
  const cleaned = raw.replace(/^@/, '');
  const channelId = hint.type === 'channel_id' ? cleaned : null;
  const displayName = cleaned || 'YouTube';
  const channelUrl = hint.type === 'handle'
    ? `https://www.youtube.com/@${cleaned}`
    : (channelId ? buildYoutubeChannelUrl(channelId) : null);

  return {
    channel_id: channelId,
    channel_title: displayName,
    channel_url: channelUrl,
    avatar_url: null,
    top_artists: cleaned ? [{ name: normalizeYoutubeToken(cleaned), count: 1 }] : [],
    top_genres: [],
    degraded: true
  };
};

const getYoutubeProfile = async (userId) => {
  try {
    const [rows] = await pool.query('SELECT * FROM user_youtube WHERE user_id = ?', [userId]);
    return rows[0] || null;
  } catch (err) {
    if (err?.code === 'ER_NO_SUCH_TABLE') {
      return null;
    }
    throw err;
  }
};

const upsertYoutubeProfile = async ({
  userId,
  channelId,
  channelTitle,
  channelUrl,
  avatarUrl,
  topArtists,
  topGenres
}) => {
  const params = [
    userId,
    channelId || null,
    channelTitle || null,
    channelUrl || null,
    avatarUrl || null,
    JSON.stringify(topArtists || []),
    JSON.stringify(topGenres || [])
  ];

  const statement = `INSERT INTO user_youtube
    (user_id, channel_id, channel_title, channel_url, avatar_url, top_artists, top_genres, last_synced_at)
   VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
   ON DUPLICATE KEY UPDATE
     channel_id = VALUES(channel_id),
     channel_title = VALUES(channel_title),
     channel_url = VALUES(channel_url),
     avatar_url = VALUES(avatar_url),
     top_artists = VALUES(top_artists),
     top_genres = VALUES(top_genres),
     last_synced_at = CURRENT_TIMESTAMP`;

  try {
    await pool.query(statement, params);
  } catch (err) {
    if (err?.code !== 'ER_NO_SUCH_TABLE') throw err;
    await ensureAuthSchema();
    await pool.query(statement, params);
  }
};

const serializeYoutubeProfile = (row, overrides = {}) => ({
  synced: true,
  channel_id: overrides.channel_id ?? row?.channel_id ?? null,
  channel_title: overrides.channel_title ?? row?.channel_title ?? null,
  channel_url: overrides.channel_url ?? row?.channel_url ?? null,
  avatar_url: overrides.avatar_url ?? row?.avatar_url ?? null,
  top_artists: overrides.top_artists ?? parseJsonField(row?.top_artists, []),
  top_genres: overrides.top_genres ?? parseJsonField(row?.top_genres, [])
});

const isManualYoutubeConnection = (row) => {
  const mode = normalizeYoutubeToken(row?.connection_mode || '');
  if (mode) return mode !== 'oauth';
  return !(row?.refresh_token || row?.access_token);
};

const buildYoutubeAuthUrl = (state) => {
  const params = new URLSearchParams({
    client_id: YOUTUBE_CLIENT_ID,
    redirect_uri: YOUTUBE_REDIRECT_URI,
    response_type: 'code',
    scope: YOUTUBE_SCOPES,
    access_type: 'offline',
    include_granted_scopes: 'true',
    prompt: 'consent',
    state
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

const extractYoutubeIdentity = (value) => {
  const hint = extractYoutubeProfileHint(value);
  if (!hint?.value) return '';
  return `${hint.type}:${normalizeYoutubeToken(hint.value).replace(/^@/, '')}`;
};

const isSameYoutubeProfile = (row, profileInput) => {
  const incoming = extractYoutubeIdentity(profileInput);
  if (!incoming) return false;
  const known = new Set([
    row?.channel_id ? `channel_id:${normalizeYoutubeToken(row.channel_id)}` : '',
    row?.channel_url ? extractYoutubeIdentity(row.channel_url) : '',
    row?.channel_title ? `query:${normalizeYoutubeToken(row.channel_title)}` : ''
  ].filter(Boolean));
  return known.has(incoming);
};

const isYoutubeSyncFresh = (value) => {
  if (!value || YOUTUBE_SYNC_CACHE_TTL_MS <= 0) return false;
  const syncedAt = new Date(value).getTime();
  if (Number.isNaN(syncedAt)) return false;
  return (Date.now() - syncedAt) <= YOUTUBE_SYNC_CACHE_TTL_MS;
};

const syncYoutubeProfile = async (userId, profileInput = null) => {
  const normalizedInput = normalizeYoutubeProfileInput(profileInput);
  const existing = await getYoutubeProfile(userId);
  const buildDegradedFromExisting = (reason = 'youtube_sync_degraded', overrides = {}) => {
    if (!existing) return null;
    return {
      ...serializeYoutubeProfile(existing, overrides),
      cached: true,
      degraded: true,
      reason
    };
  };

  if (!youtubeApiConfigured()) {
    const degraded = buildDegradedFromExisting('youtube_not_configured');
    if (degraded) return degraded;
    if (!normalizedInput) {
      const error = new Error('YouTube is not configured');
      error.status = 500;
      throw error;
    }
    const fallbackProfile = buildYoutubeFallbackProfile(normalizedInput);
    await upsertYoutubeProfile({
      userId,
      channelId: fallbackProfile.channel_id,
      channelTitle: fallbackProfile.channel_title,
      channelUrl: fallbackProfile.channel_url,
      avatarUrl: fallbackProfile.avatar_url,
      topArtists: fallbackProfile.top_artists,
      topGenres: fallbackProfile.top_genres
    });
    return {
      synced: true,
      ...fallbackProfile
    };
  }

  if (existing && normalizedInput && isSameYoutubeProfile(existing, normalizedInput) && isYoutubeSyncFresh(existing.last_synced_at)) {
    return {
      ...serializeYoutubeProfile(existing),
      cached: true
    };
  }

  if (existing && !normalizedInput && isYoutubeSyncFresh(existing.last_synced_at)) {
    return {
      ...serializeYoutubeProfile(existing),
      cached: true
    };
  }

  let channel = null;
  if (normalizedInput) {
    try {
      channel = await resolveYoutubeChannel(normalizedInput);
    } catch (err) {
      const status = Number(err?.status || 0);
      if ([400, 403, 404, 429].includes(status)) {
        if (existing && isSameYoutubeProfile(existing, normalizedInput)) {
          const degraded = buildDegradedFromExisting('youtube_channel_cached');
          if (degraded) return degraded;
        }
        const fallbackProfile = buildYoutubeFallbackProfile(normalizedInput);
        await upsertYoutubeProfile({
          userId,
          channelId: fallbackProfile.channel_id,
          channelTitle: fallbackProfile.channel_title,
          channelUrl: fallbackProfile.channel_url,
          avatarUrl: fallbackProfile.avatar_url,
          topArtists: fallbackProfile.top_artists,
          topGenres: fallbackProfile.top_genres
        });
        return {
          synced: true,
          ...fallbackProfile
        };
      }
      if (existing) {
        const degraded = buildDegradedFromExisting('youtube_upstream_unavailable');
        if (degraded) return degraded;
      }
      throw err;
    }
  } else if (existing) {
    try {
      channel = await resolveYoutubeChannel(existing.channel_url || existing.channel_id || existing.channel_title);
    } catch (err) {
      const degraded = buildDegradedFromExisting('youtube_upstream_unavailable');
      if (degraded) return degraded;
      throw err;
    }
  } else {
    return { synced: false, reason: 'not_linked' };
  }

  const channelId = channel?.channel_id || null;
  if (!channelId) {
    const degraded = buildDegradedFromExisting('youtube_channel_missing');
    if (degraded) return degraded;
    const error = new Error('Could not resolve YouTube channel id');
    error.status = 502;
    throw error;
  }

  let videos = [];
  try {
    videos = await fetchYoutubeVideosForChannel(channelId);
  } catch (err) {
    const degraded = buildDegradedFromExisting('youtube_videos_unavailable');
    if (degraded) return degraded;
    throw err;
  }

  const topGenres = computeYoutubeTopGenres(videos);
  const topArtists = computeYoutubeTopArtists(videos, channel.channel_title || channelId);

  await upsertYoutubeProfile({
    userId,
    channelId,
    channelTitle: channel.channel_title,
    channelUrl: channel.channel_url,
    avatarUrl: channel.avatar_url,
    topArtists,
    topGenres
  });

  return {
    synced: true,
    channel_id: channelId,
    channel_title: channel.channel_title || null,
    channel_url: channel.channel_url || buildYoutubeChannelUrl(channelId),
    avatar_url: channel.avatar_url || null,
    top_artists: topArtists,
    top_genres: topGenres
  };
};

const normalizeSpotifyToken = (value) => (value || '')
  .toString()
  .trim()
  .toLowerCase();

const normalizeSpotifyProfileInput = (value) => (value || '').toString().trim();

const extractSpotifyUserId = (profileInput) => {
  const input = normalizeSpotifyProfileInput(profileInput);
  if (!input) return null;

  if (input.startsWith('spotify:user:')) {
    const candidate = input.split(':').pop();
    return candidate ? candidate.trim() : null;
  }

  if (input.startsWith('http://') || input.startsWith('https://')) {
    try {
      const parsed = new URL(input);
      const host = parsed.hostname.toLowerCase();
      if (!host.endsWith('spotify.com')) return null;
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length >= 2 && normalizeSpotifyToken(parts[0]) === 'user') {
        return parts[1];
      }
      return null;
    } catch {
      return null;
    }
  }

  const plain = input.replace(/^@/, '');
  if (!plain) return null;
  return plain;
};

const buildSpotifyProfileUrl = (spotifyUserId) => `https://open.spotify.com/user/${encodeURIComponent(spotifyUserId)}`;

const isManualSpotifyConnection = (row) => {
  const mode = normalizeSpotifyToken(row?.connection_mode || row?.token_type);
  return mode === 'manual';
};

const buildSpotifyAuthUrl = (state) => {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: SPOTIFY_CLIENT_ID,
    scope: SPOTIFY_SCOPES,
    redirect_uri: SPOTIFY_REDIRECT_URI,
    state
  });
  return `https://accounts.spotify.com/authorize?${params.toString()}`;
};

const fetchJson = async (url, options) => {
  const res = await fetch(url, options);
  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }
  if (!res.ok) {
    const message = data.error_description || data.error?.message || data.error || 'Spotify API error';
    const error = new Error(message);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
};

const getSpotifyAppAccessToken = async () => {
  if (!spotifyAppConfigured()) {
    const error = new Error('Spotify API client credentials are not configured');
    error.status = 500;
    throw error;
  }

  if (spotifyAppAccessToken && Date.now() < spotifyAppAccessTokenExpiresAt - 60_000) {
    return spotifyAppAccessToken;
  }

  const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const body = new URLSearchParams({ grant_type: 'client_credentials' });
  const data = await fetchJson('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${auth}`
    },
    body
  });

  if (!data.access_token) {
    const error = new Error('Failed to get Spotify app access token');
    error.status = 502;
    throw error;
  }

  spotifyAppAccessToken = data.access_token;
  spotifyAppAccessTokenExpiresAt = Date.now() + (Number(data.expires_in || 3600) * 1000);
  return spotifyAppAccessToken;
};

const fetchSpotifyAppJson = async (url) => {
  let token = await getSpotifyAppAccessToken();
  try {
    return await fetchJson(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  } catch (err) {
    if (Number(err?.status || 0) !== 401) throw err;
    spotifyAppAccessToken = null;
    spotifyAppAccessTokenExpiresAt = 0;
    token = await getSpotifyAppAccessToken();
    return fetchJson(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
  }
};

const serializeDateTime = (date) => date.toISOString().slice(0, 19).replace('T', ' ');

const upsertYoutubeOAuthTokens = async ({
  userId,
  channelId,
  channelTitle,
  channelUrl,
  avatarUrl,
  accessToken,
  refreshToken,
  tokenType,
  scope,
  expiresAt
}) => {
  const params = [
    userId,
    channelId || null,
    channelTitle || null,
    channelUrl || null,
    avatarUrl || null,
    accessToken || null,
    refreshToken || null,
    tokenType || 'Bearer',
    scope || null,
    expiresAt ? serializeDateTime(expiresAt) : null
  ];
  const statement = `INSERT INTO user_youtube
    (user_id, channel_id, channel_title, channel_url, avatar_url,
     access_token, refresh_token, token_type, scope, expires_at, connection_mode)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'oauth')
   ON DUPLICATE KEY UPDATE
     channel_id = COALESCE(VALUES(channel_id), channel_id),
     channel_title = COALESCE(VALUES(channel_title), channel_title),
     channel_url = COALESCE(VALUES(channel_url), channel_url),
     avatar_url = COALESCE(VALUES(avatar_url), avatar_url),
     access_token = VALUES(access_token),
     refresh_token = IF(VALUES(refresh_token) IS NULL, refresh_token, VALUES(refresh_token)),
     token_type = VALUES(token_type),
     scope = VALUES(scope),
     expires_at = VALUES(expires_at),
     connection_mode = 'oauth'`;
  try {
    await pool.query(statement, params);
  } catch (err) {
    if (err?.code !== 'ER_NO_SUCH_TABLE') throw err;
    await ensureAuthSchema();
    await pool.query(statement, params);
  }
};

const markYoutubeManualConnection = async (userId) => {
  await pool.query(
    `UPDATE user_youtube
     SET connection_mode = 'manual',
         access_token = NULL,
         refresh_token = NULL,
         token_type = NULL,
         scope = NULL,
         expires_at = NULL
     WHERE user_id = ?`,
    [userId]
  );
};

const refreshYoutubeOAuthAccessToken = async (refreshToken) => {
  const body = new URLSearchParams({
    client_id: YOUTUBE_CLIENT_ID,
    client_secret: YOUTUBE_CLIENT_SECRET,
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  });
  return fetchJson('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });
};

const fetchYoutubeOAuthApiJson = async (url, accessToken) => {
  if (!accessToken) {
    const error = new Error('Missing YouTube OAuth access token');
    error.status = 401;
    throw error;
  }
  let attempt = 0;
  while (true) {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`
      }
    });
    const text = await res.text();
    let data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }
    }
    if (res.ok) return data;
    const status = Number(res.status || 0);
    const message = data?.error?.message || data?.error_description || data?.error || 'YouTube API error';
    if (isRetryableYoutubeError(status) && attempt < YOUTUBE_HTTP_RETRY_ATTEMPTS) {
      const retryAfter = parseRetryAfterMs(res.headers.get('retry-after'));
      const backoff = retryAfter ?? Math.min(YOUTUBE_HTTP_BACKOFF_MS * (attempt + 1), 120000);
      const jitter = Math.floor(Math.random() * 250);
      await sleep(backoff + jitter);
      attempt += 1;
      continue;
    }
    const error = new Error(message);
    error.status = status || 500;
    error.data = data;
    throw error;
  }
};

const getValidYoutubeOAuthAccessToken = async (userId) => {
  const row = await getYoutubeProfile(userId);
  if (!row || isManualYoutubeConnection(row)) {
    return null;
  }
  if (!youtubeOAuthConfigured()) {
    return null;
  }
  const expiresAtMs = row?.expires_at ? new Date(row.expires_at).getTime() : 0;
  if (row?.access_token && Number.isFinite(expiresAtMs) && expiresAtMs - Date.now() > 60_000) {
    return row.access_token;
  }
  if (!row?.refresh_token) {
    return null;
  }
  const refresh = await refreshYoutubeOAuthAccessToken(row.refresh_token);
  const newAccessToken = refresh?.access_token || null;
  if (!newAccessToken) {
    const error = new Error('Failed to refresh YouTube access token');
    error.status = 502;
    throw error;
  }
  const newExpiresAt = new Date(Date.now() + (Number(refresh?.expires_in || 3600) * 1000));
  await upsertYoutubeOAuthTokens({
    userId,
    channelId: row.channel_id || null,
    channelTitle: row.channel_title || null,
    channelUrl: row.channel_url || null,
    avatarUrl: row.avatar_url || null,
    accessToken: newAccessToken,
    refreshToken: refresh?.refresh_token || null,
    tokenType: refresh?.token_type || row?.token_type || 'Bearer',
    scope: refresh?.scope || row?.scope || null,
    expiresAt: newExpiresAt
  });
  return newAccessToken;
};

const fetchYoutubeOAuthVideosByIds = async (accessToken, ids = []) => {
  const uniqueIds = Array.from(new Set((ids || []).filter(Boolean)));
  if (uniqueIds.length === 0) return [];
  const out = [];
  for (let start = 0; start < uniqueIds.length; start += 50) {
    const chunk = uniqueIds.slice(start, start + 50);
    const data = await fetchYoutubeOAuthApiJson(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,topicDetails&id=${chunk.map(encodeURIComponent).join(',')}&maxResults=${chunk.length}`,
      accessToken
    );
    out.push(...(Array.isArray(data?.items) ? data.items : []));
  }
  return out;
};

const fetchYoutubeOAuthLikedVideos = async (accessToken, pageLimit = 2) => {
  const videos = [];
  let pageToken = null;
  let pageCount = 0;
  do {
    const params = new URLSearchParams({
      part: 'snippet,topicDetails',
      myRating: 'like',
      maxResults: '50'
    });
    if (pageToken) params.set('pageToken', pageToken);
    const data = await fetchYoutubeOAuthApiJson(
      `https://www.googleapis.com/youtube/v3/videos?${params.toString()}`,
      accessToken
    );
    videos.push(...(Array.isArray(data?.items) ? data.items : []));
    pageToken = data?.nextPageToken || null;
    pageCount += 1;
  } while (pageToken && pageCount < pageLimit);
  return videos;
};

const fetchYoutubeOAuthSubscriptions = async (accessToken, pageLimit = 2) => {
  const subscriptions = [];
  let pageToken = null;
  let pageCount = 0;
  do {
    const params = new URLSearchParams({
      part: 'snippet',
      mine: 'true',
      maxResults: '50'
    });
    if (pageToken) params.set('pageToken', pageToken);
    const data = await fetchYoutubeOAuthApiJson(
      `https://www.googleapis.com/youtube/v3/subscriptions?${params.toString()}`,
      accessToken
    );
    subscriptions.push(...(Array.isArray(data?.items) ? data.items : []));
    pageToken = data?.nextPageToken || null;
    pageCount += 1;
  } while (pageToken && pageCount < pageLimit);
  return subscriptions;
};

const fetchYoutubeOAuthRecentUploads = async (accessToken, uploadsPlaylistId) => {
  if (!uploadsPlaylistId) return [];
  const list = await fetchYoutubeOAuthApiJson(
    `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${encodeURIComponent(uploadsPlaylistId)}&maxResults=25`,
    accessToken
  );
  const ids = (Array.isArray(list?.items) ? list.items : [])
    .map((item) => item?.snippet?.resourceId?.videoId || null)
    .filter(Boolean);
  return fetchYoutubeOAuthVideosByIds(accessToken, ids);
};

const YOUTUBE_ORG_NAME_KEYWORDS = [
  'records', 'recordings', 'label', 'radio', 'fm', 'tv', 'festival',
  'events', 'club', 'venue', 'collective', 'promotions', 'booking'
];

const looksLikeYoutubeOrgName = (value) => {
  const name = normalizeYoutubeToken(value);
  if (!name) return false;
  return YOUTUBE_ORG_NAME_KEYWORDS.some((keyword) => name.includes(keyword));
};

const mergeYoutubeArtistSignals = ({ videoArtists = [], subscriptions = [], channelTitle = '' }) => {
  const counts = new Map();
  const add = (name, count, source) => {
    const normalized = normalizeYoutubeToken(name);
    if (!normalized) return;
    const current = counts.get(normalized) || { name: normalized, count: 0, source };
    current.count += Number(count || 0) || 0;
    current.source = current.source || source;
    counts.set(normalized, current);
  };

  (Array.isArray(videoArtists) ? videoArtists : []).forEach((item) => add(item?.name, (item?.count || 1) * 2, 'youtube_videos'));

  (Array.isArray(subscriptions) ? subscriptions : []).forEach((item) => {
    const title = item?.snippet?.title || item?.snippet?.resourceTitle || '';
    if (!title || looksLikeYoutubeOrgName(title)) return;
    add(title, 1, 'youtube_subscriptions');
  });

  if (counts.size === 0 && channelTitle) {
    add(channelTitle, 1, 'youtube_channel');
  }

  return Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
};

const syncYoutubeOAuthProfile = async (userId) => {
  const existing = await getYoutubeProfile(userId);
  if (!existing || isManualYoutubeConnection(existing)) {
    return { synced: false, reason: 'oauth_not_linked' };
  }

  const degradedFromExisting = (reason) => ({
    ...serializeYoutubeProfile(existing),
    mode: 'oauth',
    cached: true,
    degraded: true,
    reason
  });

  if (isYoutubeSyncFresh(existing.last_synced_at)) {
    return {
      ...serializeYoutubeProfile(existing),
      mode: 'oauth',
      cached: true
    };
  }

  if (!youtubeOAuthConfigured()) {
    return degradedFromExisting('youtube_oauth_not_configured');
  }

  let accessToken;
  try {
    accessToken = await getValidYoutubeOAuthAccessToken(userId);
  } catch (err) {
    if (existing) return degradedFromExisting('youtube_oauth_refresh_failed');
    throw err;
  }
  if (!accessToken) {
    return { synced: false, reason: 'oauth_not_linked' };
  }

  let channelData;
  try {
    channelData = await fetchYoutubeOAuthApiJson(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&mine=true&maxResults=1',
      accessToken
    );
  } catch (err) {
    if (existing) return degradedFromExisting('youtube_oauth_channel_unavailable');
    throw err;
  }

  const channel = Array.isArray(channelData?.items) ? channelData.items[0] : null;
  if (!channel?.id) {
    if (existing) return degradedFromExisting('youtube_oauth_channel_missing');
    const error = new Error('Could not load YouTube channel for connected account');
    error.status = 502;
    throw error;
  }

  const channelId = channel.id;
  const channelTitle = channel?.snippet?.title || existing?.channel_title || null;
  const channelUrl = buildYoutubeChannelUrl(channelId);
  const avatarUrl = channel?.snippet?.thumbnails?.high?.url
    || channel?.snippet?.thumbnails?.medium?.url
    || channel?.snippet?.thumbnails?.default?.url
    || existing?.avatar_url
    || null;
  const uploadsPlaylistId = channel?.contentDetails?.relatedPlaylists?.uploads || null;

  const settled = await Promise.allSettled([
    fetchYoutubeOAuthLikedVideos(accessToken),
    fetchYoutubeOAuthSubscriptions(accessToken),
    fetchYoutubeOAuthRecentUploads(accessToken, uploadsPlaylistId)
  ]);

  const likedVideos = settled[0].status === 'fulfilled' ? settled[0].value : [];
  const subscriptions = settled[1].status === 'fulfilled' ? settled[1].value : [];
  const uploadVideos = settled[2].status === 'fulfilled' ? settled[2].value : [];

  const videoById = new Map();
  [...likedVideos, ...uploadVideos].forEach((item) => {
    const id = item?.id || item?.snippet?.resourceId?.videoId || null;
    if (!id || videoById.has(id)) return;
    videoById.set(id, item);
  });
  const videos = Array.from(videoById.values());

  const topGenres = computeYoutubeTopGenres(videos);
  const videoArtists = computeYoutubeTopArtists(videos, channelTitle || channelId);
  const topArtists = mergeYoutubeArtistSignals({ videoArtists, subscriptions, channelTitle: channelTitle || channelId });

  await upsertYoutubeProfile({
    userId,
    channelId,
    channelTitle,
    channelUrl,
    avatarUrl,
    topArtists,
    topGenres
  });
  await pool.query('UPDATE user_youtube SET connection_mode = ? WHERE user_id = ?', ['oauth', userId]);

  return {
    synced: true,
    mode: 'oauth',
    channel_id: channelId,
    channel_title: channelTitle,
    channel_url: channelUrl,
    avatar_url: avatarUrl,
    top_artists: topArtists,
    top_genres: topGenres
  };
};

const syncYoutubeProfileAuto = async (userId) => {
  const row = await getYoutubeProfile(userId);
  if (!row) return { synced: false, reason: 'not_linked' };
  if (!isManualYoutubeConnection(row)) {
    return syncYoutubeOAuthProfile(userId);
  }
  return syncYoutubeProfile(userId);
};

const getSpotifyTokens = async (userId) => {
  const [rows] = await pool.query(
    'SELECT * FROM user_spotify WHERE user_id = ?',
    [userId]
  );
  return rows[0] || null;
};

const upsertSpotifyTokens = async ({
  userId,
  spotifyUserId,
  accessToken,
  refreshToken,
  tokenType,
  scope,
  expiresAt
}) => {
  await pool.query(
    `INSERT INTO user_spotify
      (user_id, spotify_user_id, access_token, refresh_token, token_type, scope, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       spotify_user_id = VALUES(spotify_user_id),
       access_token = VALUES(access_token),
       refresh_token = IF(VALUES(refresh_token) IS NULL, refresh_token, VALUES(refresh_token)),
       token_type = VALUES(token_type),
       scope = VALUES(scope),
       expires_at = VALUES(expires_at)`,
    [
      userId,
      spotifyUserId,
      accessToken,
      refreshToken || null,
      tokenType || 'Bearer',
      scope || null,
      serializeDateTime(expiresAt)
    ]
  );
};

const upsertSpotifyManualProfile = async ({
  userId,
  spotifyUserId,
  displayName,
  profileUrl,
  avatarUrl
}) => {
  const farFuture = new Date(Date.now() + (365 * 24 * 60 * 60 * 1000));
  await pool.query(
    `INSERT INTO user_spotify
      (user_id, spotify_user_id, access_token, refresh_token, token_type, scope, expires_at, connection_mode, display_name, profile_url, avatar_url)
     VALUES (?, ?, ?, NULL, 'manual', 'public_profile', ?, 'manual', ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       spotify_user_id = VALUES(spotify_user_id),
       access_token = VALUES(access_token),
       refresh_token = NULL,
       token_type = 'manual',
       scope = 'public_profile',
       expires_at = VALUES(expires_at),
       connection_mode = 'manual',
       display_name = VALUES(display_name),
       profile_url = VALUES(profile_url),
       avatar_url = VALUES(avatar_url)`,
    [
      userId,
      spotifyUserId,
      `manual:${spotifyUserId}`,
      serializeDateTime(farFuture),
      displayName || spotifyUserId,
      profileUrl || buildSpotifyProfileUrl(spotifyUserId),
      avatarUrl || null
    ]
  );
};

const updateSpotifyConnectionMeta = async ({
  userId,
  connectionMode,
  displayName,
  profileUrl,
  avatarUrl
}) => {
  await pool.query(
    `UPDATE user_spotify
     SET connection_mode = ?, display_name = ?, profile_url = ?, avatar_url = ?
     WHERE user_id = ?`,
    [
      connectionMode,
      displayName || null,
      profileUrl || null,
      avatarUrl || null,
      userId
    ]
  );
};

const refreshSpotifyAccessToken = async (refreshToken) => {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  });
  const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
  const data = await fetchJson('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${auth}`
    },
    body
  });
  return data;
};

const getValidSpotifyAccessToken = async (userId) => {
  const tokenRow = await getSpotifyTokens(userId);
  if (!tokenRow) {
    return null;
  }
  if (isManualSpotifyConnection(tokenRow)) {
    return null;
  }
  if (!spotifyAppConfigured()) {
    return null;
  }
  const expiresAt = tokenRow.expires_at ? new Date(tokenRow.expires_at) : null;
  const now = new Date();
  if (expiresAt && expiresAt.getTime() - now.getTime() > 60 * 1000) {
    return tokenRow.access_token;
  }
  if (!tokenRow.refresh_token) {
    return null;
  }
  const refresh = await refreshSpotifyAccessToken(tokenRow.refresh_token);
  const newAccessToken = refresh.access_token;
  const newExpiresAt = new Date(Date.now() + (refresh.expires_in * 1000));
  await upsertSpotifyTokens({
    userId,
    spotifyUserId: tokenRow.spotify_user_id,
    accessToken: newAccessToken,
    refreshToken: refresh.refresh_token || null,
    tokenType: refresh.token_type || tokenRow.token_type,
    scope: refresh.scope || tokenRow.scope,
    expiresAt: newExpiresAt
  });
  return newAccessToken;
};

const computeTopGenres = (artists) => {
  const counts = new Map();
  artists.forEach(artist => {
    (artist.genres || []).forEach(genre => {
      counts.set(genre, (counts.get(genre) || 0) + 1);
    });
  });
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([genre, count]) => ({ genre, count }));
};

const fetchSpotifyPublicProfileByUserId = async (spotifyUserId) => {
  const data = await fetchSpotifyAppJson(`https://api.spotify.com/v1/users/${encodeURIComponent(spotifyUserId)}`);
  if (!data?.id) {
    const error = new Error('Spotify profile was not found');
    error.status = 404;
    throw error;
  }
  return data;
};

const collectPublicSpotifyArtistSignals = async (spotifyUserId) => {
  const playlistResponse = await fetchSpotifyAppJson(
    `https://api.spotify.com/v1/users/${encodeURIComponent(spotifyUserId)}/playlists?limit=8`
  );
  const playlists = (playlistResponse?.items || [])
    .filter((playlist) => playlist?.id)
    .slice(0, 8);

  if (playlists.length === 0) {
    return { topArtists: [], topGenres: [] };
  }

  const trackCalls = playlists.map((playlist) => fetchSpotifyAppJson(
    `https://api.spotify.com/v1/playlists/${encodeURIComponent(playlist.id)}/tracks?limit=50&fields=items(track(artists(id,name)))`
  ));
  const trackResults = await Promise.allSettled(trackCalls);
  const artistCounts = new Map();

  trackResults.forEach((result) => {
    if (result.status !== 'fulfilled') return;
    const items = result.value?.items || [];
    items.forEach((entry) => {
      (entry?.track?.artists || []).forEach((artist) => {
        const name = (artist?.name || '').trim();
        if (!name) return;
        const key = artist?.id || name.toLowerCase();
        const current = artistCounts.get(key) || { id: artist?.id || null, name, count: 0 };
        current.count += 1;
        artistCounts.set(key, current);
      });
    });
  });

  const sortedArtists = Array.from(artistCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);

  if (sortedArtists.length === 0) {
    return { topArtists: [], topGenres: [] };
  }

  const artistDetailsById = new Map();
  const artistIds = sortedArtists.map((artist) => artist.id).filter(Boolean);
  for (let start = 0; start < artistIds.length; start += 50) {
    const chunk = artistIds.slice(start, start + 50);
    if (!chunk.length) continue;
    try {
      const details = await fetchSpotifyAppJson(`https://api.spotify.com/v1/artists?ids=${chunk.map(encodeURIComponent).join(',')}`);
      (details?.artists || []).forEach((artist) => {
        if (artist?.id) {
          artistDetailsById.set(artist.id, artist);
        }
      });
    } catch (err) {
      console.warn('Spotify public artist details fetch failed:', err.message);
    }
  }

  const topArtists = sortedArtists
    .slice(0, 20)
    .map((artist) => {
      const detail = artist.id ? artistDetailsById.get(artist.id) : null;
      return {
        id: artist.id || null,
        name: artist.name,
        popularity: detail?.popularity || null,
        genres: detail?.genres || [],
        count: artist.count,
        source: 'public_playlists'
      };
    });

  return {
    topArtists,
    topGenres: computeTopGenres(topArtists)
  };
};

const syncSpotifyPublicProfile = async (userId, tokenRow) => {
  const cachedArtists = parseJsonField(tokenRow?.top_artists, []);
  const cachedGenres = parseJsonField(tokenRow?.top_genres, []);
  const lastSyncedAtMs = tokenRow?.last_synced_at ? new Date(tokenRow.last_synced_at).getTime() : 0;
  const cacheFresh = lastSyncedAtMs > 0 && SPOTIFY_PUBLIC_SYNC_TTL_MS > 0
    && (Date.now() - lastSyncedAtMs) <= SPOTIFY_PUBLIC_SYNC_TTL_MS;

  if (cacheFresh) {
    return {
      synced: true,
      cached: true,
      mode: 'manual',
      top_artists: cachedArtists,
      top_genres: cachedGenres
    };
  }

  if (!spotifyAppConfigured()) {
    return {
      synced: true,
      degraded: true,
      mode: 'manual',
      reason: 'spotify_api_not_configured',
      top_artists: cachedArtists,
      top_genres: cachedGenres
    };
  }

  const spotifyUserId = tokenRow?.spotify_user_id;
  if (!spotifyUserId) {
    return { synced: false, reason: 'not_linked' };
  }

  const profile = await fetchSpotifyPublicProfileByUserId(spotifyUserId);
  let signals;
  try {
    signals = await collectPublicSpotifyArtistSignals(spotifyUserId);
  } catch (err) {
    console.warn('Spotify public signal fetch failed:', err.message);
    signals = { topArtists: [], topGenres: [] };
  }

  const fallbackArtistName = profile.display_name || profile.id;
  const topArtists = (signals.topArtists || []).length > 0
    ? signals.topArtists
    : [{ id: profile.id, name: fallbackArtistName, popularity: null, genres: [], count: 1, source: 'public_profile' }];
  const topGenres = (signals.topGenres || []).length > 0 ? signals.topGenres : [];
  const profileUrl = profile?.external_urls?.spotify || tokenRow?.profile_url || buildSpotifyProfileUrl(spotifyUserId);
  const avatarUrl = profile?.images?.[0]?.url || null;

  await pool.query(
    `UPDATE user_spotify
     SET connection_mode = 'manual',
         display_name = ?,
         profile_url = ?,
         avatar_url = ?,
         top_artists = ?,
         top_genres = ?,
         last_synced_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`,
    [
      profile.display_name || null,
      profileUrl,
      avatarUrl,
      JSON.stringify(topArtists),
      JSON.stringify(topGenres),
      userId
    ]
  );

  return {
    synced: true,
    mode: 'manual',
    spotify_user_id: profile.id,
    display_name: profile.display_name || null,
    profile_url: profileUrl,
    avatar_url: avatarUrl,
    top_artists: topArtists,
    top_genres: topGenres
  };
};

const syncSpotifyOAuthProfile = async (userId) => {
  if (!spotifyAppConfigured()) {
    return { synced: false, reason: 'spotify_api_not_configured' };
  }
  const accessToken = await getValidSpotifyAccessToken(userId);
  if (!accessToken) {
    return { synced: false, reason: 'oauth_not_linked' };
  }
  const authHeaders = { Authorization: `Bearer ${accessToken}` };
  const combined = new Map();

  const addArtists = (items, source) => {
    items.forEach(item => {
      const name = item?.name || '';
      if (!name) return;
      const key = item?.id || name.toLowerCase();
      if (!combined.has(key)) {
        combined.set(key, {
          id: item?.id || null,
          name,
          popularity: item?.popularity || null,
          genres: item?.genres || [],
          source
        });
      } else {
        const existing = combined.get(key);
        if ((!existing.popularity || existing.popularity === 0) && item?.popularity) {
          existing.popularity = item.popularity;
        }
        if ((!existing.genres || existing.genres.length === 0) && item?.genres?.length) {
          existing.genres = item.genres;
        }
        combined.set(key, existing);
      }
    });
  };

  // Top artists
  try {
    const data = await fetchJson('https://api.spotify.com/v1/me/top/artists?limit=50&time_range=medium_term', {
      headers: authHeaders
    });
    addArtists(data.items || [], 'top');
  } catch (err) {
    console.warn('Spotify top artists fetch failed:', err.message);
  }

  // Followed artists
  try {
    const followed = await fetchJson('https://api.spotify.com/v1/me/following?type=artist&limit=50', {
      headers: authHeaders
    });
    addArtists(followed?.artists?.items || [], 'followed');
  } catch (err) {
    console.warn('Spotify followed artists fetch failed:', err.message);
  }

  // Saved track artists
  try {
    const saved = await fetchJson('https://api.spotify.com/v1/me/tracks?limit=50', {
      headers: authHeaders
    });
    const trackArtists = (saved?.items || [])
      .flatMap(item => item?.track?.artists || [])
      .map(artist => ({
        id: artist?.id || null,
        name: artist?.name || '',
        popularity: null,
        genres: []
      }));
    addArtists(trackArtists, 'saved_tracks');
  } catch (err) {
    console.warn('Spotify saved tracks fetch failed:', err.message);
  }

  const artists = Array.from(combined.values());
  const topGenres = computeTopGenres(artists);
  await pool.query(
    `UPDATE user_spotify
     SET connection_mode = 'oauth',
         top_artists = ?,
         top_genres = ?,
         last_synced_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`,
    [JSON.stringify(artists), JSON.stringify(topGenres), userId]
  );
  return { synced: true, mode: 'oauth', top_artists: artists, top_genres: topGenres };
};

const syncSpotifyProfile = async (userId) => {
  const tokenRow = await getSpotifyTokens(userId);
  if (!tokenRow) {
    return { synced: false, reason: 'not_linked' };
  }
  if (isManualSpotifyConnection(tokenRow)) {
    return syncSpotifyPublicProfile(userId, tokenRow);
  }
  return syncSpotifyOAuthProfile(userId);
};

const connectSpotifyProfile = async (userId, profileInput) => {
  const spotifyUserId = extractSpotifyUserId(profileInput);
  if (!spotifyUserId) {
    const error = new Error('Spotify profile URL or user id is required (example: https://open.spotify.com/user/<id>)');
    error.status = 400;
    throw error;
  }

  let profile = null;
  if (spotifyAppConfigured()) {
    profile = await fetchSpotifyPublicProfileByUserId(spotifyUserId);
  }

  await upsertSpotifyManualProfile({
    userId,
    spotifyUserId: profile?.id || spotifyUserId,
    displayName: profile?.display_name || spotifyUserId,
    profileUrl: profile?.external_urls?.spotify || buildSpotifyProfileUrl(spotifyUserId),
    avatarUrl: profile?.images?.[0]?.url || null
  });

  const result = await syncSpotifyProfile(userId);
  return {
    linked: true,
    mode: 'manual',
    spotify_user_id: profile?.id || spotifyUserId,
    display_name: profile?.display_name || spotifyUserId,
    profile_url: profile?.external_urls?.spotify || buildSpotifyProfileUrl(spotifyUserId),
    avatar_url: profile?.images?.[0]?.url || null,
    ...result
  };
};

// Endpoint for user signup
app.post('/auth/signup', authLimiter, async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(8),
      role: z.enum(['user', 'organizer']).optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, 'invalid_body', 'Invalid request body', parsed.error.flatten());
    }
    const { name, email, password, role } = parsed.data;

    // Check if the user already exists
    const [existing] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return sendError(res, 400, 'user_exists', 'User already exists');
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    // Insert new user into the database
    await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, role || 'user']
    );

    return res.status(201).json({ message: 'User created successfully' });
  } catch (err) {
    console.error(err);
    return handleRouteError(res, err, 'Server error');
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
      { user_id: user.id, role: user.role || 'user' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    return res.status(200).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role || 'user' }
    });
  } catch (err) {
    console.error(err);
    return handleRouteError(res, err, 'Server error');
  }
});

app.get('/auth/spotify/login', (req, res) => {
  if (!spotifyConfigured()) {
    return sendError(
      res,
      500,
      'spotify_not_configured',
      'Spotify OAuth is not configured',
      { missing_env: spotifyMissingConfig() }
    );
  }
  const authHeader = req.headers.authorization || '';
  const headerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const queryToken = typeof req.query.token === 'string' ? req.query.token : null;
  const userId = getUserIdFromToken(headerToken) || getUserIdFromToken(queryToken);
  if (!userId) {
    return sendError(res, 401, 'unauthorized', 'Missing bearer token');
  }
  const state = jwt.sign(
    { user_id: userId, nonce: crypto.randomUUID() },
    JWT_SECRET,
    { expiresIn: '10m' }
  );
  return res.redirect(buildSpotifyAuthUrl(state));
});

app.get('/auth/spotify/callback', async (req, res) => {
  if (!spotifyConfigured()) {
    return sendError(
      res,
      500,
      'spotify_not_configured',
      'Spotify OAuth is not configured',
      { missing_env: spotifyMissingConfig() }
    );
  }
  const { code, state, error } = req.query;
  if (error) {
    return sendError(res, 400, 'spotify_auth_failed', `Spotify auth failed: ${error}`);
  }
  if (!code || !state) {
    return sendError(res, 400, 'invalid_request', 'Missing code or state');
  }

  let payload;
  try {
    payload = jwt.verify(state, JWT_SECRET);
  } catch (err) {
    return sendError(res, 400, 'invalid_state', 'Invalid or expired state');
  }

  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: String(code),
      redirect_uri: SPOTIFY_REDIRECT_URI
    });
    const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
    const tokenData = await fetchJson('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${auth}`
      },
      body
    });

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token || null;
    const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));
    const me = await fetchJson('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!refreshToken) {
      const existing = await getSpotifyTokens(payload.user_id);
      if (!existing?.refresh_token) {
        return sendError(res, 400, 'spotify_missing_refresh', 'Spotify did not return a refresh token. Revoke access and try again.');
      }
    }

    await upsertSpotifyTokens({
      userId: payload.user_id,
      spotifyUserId: me.id,
      accessToken,
      refreshToken,
      tokenType: tokenData.token_type,
      scope: tokenData.scope,
      expiresAt
    });
    await updateSpotifyConnectionMeta({
      userId: payload.user_id,
      connectionMode: 'oauth',
      displayName: me.display_name || null,
      profileUrl: me?.external_urls?.spotify || buildSpotifyProfileUrl(me.id),
      avatarUrl: me?.images?.[0]?.url || null
    });

    await syncSpotifyProfile(payload.user_id);
    return res.json({ linked: true, spotify_user_id: me.id });
  } catch (err) {
    console.error('Spotify callback error:', err.message);
    if (isDatabaseConnectionError(err)) {
      return sendError(res, 503, 'database_unavailable', 'Database is currently unavailable');
    }
    return sendError(res, err.status || 500, 'spotify_error', err.message || 'Spotify error');
  }
});

app.get('/auth/spotify/status', requireAuth, asyncHandler(async (req, res) => {
  const row = await getSpotifyTokens(req.user.user_id);
  const mode = row ? (isManualSpotifyConnection(row) ? 'manual' : 'oauth') : null;
  return res.json({
    oauth_configured: spotifyConfigured(),
    api_configured: spotifyAppConfigured(),
    linked: Boolean(row),
    mode,
    spotify_user_id: row?.spotify_user_id || null,
    display_name: row?.display_name || null,
    profile_url: row?.profile_url || null,
    avatar_url: row?.avatar_url || null,
    last_synced_at: row?.last_synced_at || null
  });
}));

app.post('/auth/spotify/connect', requireAuth, async (req, res) => {
  const schema = z.object({
    profile: z.string().min(1)
  });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    return sendError(res, 400, 'invalid_body', 'Invalid request body', parsed.error.flatten());
  }

  try {
    const result = await connectSpotifyProfile(req.user.user_id, parsed.data.profile);
    return res.json(result);
  } catch (err) {
    console.error('Spotify manual connect error:', err.message);
    if (isDatabaseConnectionError(err)) {
      return sendError(res, 503, 'database_unavailable', 'Database is currently unavailable');
    }
    return sendError(res, err.status || 500, 'spotify_error', err.message || 'Spotify error');
  }
});

app.post('/auth/spotify/sync', requireAuth, async (req, res) => {
  try {
    const result = await syncSpotifyProfile(req.user.user_id);
    if (!result.synced) {
      if (result.reason === 'spotify_api_not_configured') {
        return sendError(res, 500, 'spotify_not_configured', 'Spotify API client credentials are not configured');
      }
      return sendError(res, 400, 'spotify_not_linked', 'Spotify account not linked');
    }
    return res.json(result);
  } catch (err) {
    console.error('Spotify sync error:', err.message);
    if (isDatabaseConnectionError(err)) {
      return sendError(res, 503, 'database_unavailable', 'Database is currently unavailable');
    }
    return sendError(res, err.status || 500, 'spotify_error', err.message || 'Spotify error');
  }
});

app.get('/auth/spotify/profile', requireAuth, asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT top_artists, top_genres, last_synced_at, spotify_user_id,
            connection_mode, display_name, profile_url, avatar_url
     FROM user_spotify
     WHERE user_id = ?`,
    [req.user.user_id]
  );
  if (rows.length === 0) {
    return sendError(res, 404, 'spotify_not_linked', 'Spotify account not linked');
  }
  const row = rows[0];
  return res.json({
    mode: isManualSpotifyConnection(row) ? 'manual' : 'oauth',
    spotify_user_id: row.spotify_user_id || null,
    display_name: row.display_name || null,
    profile_url: row.profile_url || null,
    avatar_url: row.avatar_url || null,
    top_artists: parseJsonField(row.top_artists),
    top_genres: parseJsonField(row.top_genres),
    last_synced_at: row.last_synced_at
  });
}));

app.get('/auth/soundcloud/status', requireAuth, asyncHandler(async (req, res) => {
  const row = await getSoundcloudProfile(req.user.user_id);
  return res.json({
    configured: soundcloudConfigured(),
    linked: Boolean(row),
    username: row?.username || null,
    permalink_url: row?.permalink_url || null,
    avatar_url: row?.avatar_url || null,
    last_synced_at: row?.last_synced_at || null
  });
}));

app.post('/auth/soundcloud/connect', requireAuth, async (req, res) => {
  const schema = z.object({
    profile: z.string().min(1)
  });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    return sendError(res, 400, 'invalid_body', 'Invalid request body', parsed.error.flatten());
  }

  try {
    const result = await syncSoundcloudProfile(req.user.user_id, parsed.data.profile);
    return res.json({
      linked: true,
      ...result
    });
  } catch (err) {
    console.error('SoundCloud connect error:', err.message);
    if (isDatabaseConnectionError(err)) {
      return sendError(res, 503, 'database_unavailable', 'Database is currently unavailable');
    }
    return sendError(res, err.status || 500, 'soundcloud_error', err.message || 'SoundCloud error');
  }
});

app.post('/auth/soundcloud/sync', requireAuth, async (req, res) => {
  try {
    const result = await syncSoundcloudProfile(req.user.user_id);
    if (!result.synced) {
      return sendError(res, 400, 'soundcloud_not_linked', 'SoundCloud account not linked');
    }
    return res.json(result);
  } catch (err) {
    console.error('SoundCloud sync error:', err.message);
    if (isDatabaseConnectionError(err)) {
      return sendError(res, 503, 'database_unavailable', 'Database is currently unavailable');
    }
    return sendError(res, err.status || 500, 'soundcloud_error', err.message || 'SoundCloud error');
  }
});

app.get('/auth/soundcloud/profile', requireAuth, asyncHandler(async (req, res) => {
  const row = await getSoundcloudProfile(req.user.user_id);
  if (!row) {
    return sendError(res, 404, 'soundcloud_not_linked', 'SoundCloud account not linked');
  }
  return res.json({
    username: row.username || null,
    permalink_url: row.permalink_url || null,
    avatar_url: row.avatar_url || null,
    top_artists: parseJsonField(row.top_artists),
    top_genres: parseJsonField(row.top_genres),
    last_synced_at: row.last_synced_at
  });
}));

app.delete('/auth/soundcloud/disconnect', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM user_soundcloud WHERE user_id = ?', [req.user.user_id]);
    return res.json({ linked: false });
  } catch (err) {
    console.error('SoundCloud disconnect error:', err.message);
    if (isDatabaseConnectionError(err)) {
      return sendError(res, 503, 'database_unavailable', 'Database is currently unavailable');
    }
    return sendError(res, 500, 'soundcloud_error', 'Failed to disconnect SoundCloud');
  }
});

app.get('/auth/youtube/login', (req, res) => {
  if (!youtubeOAuthConfigured()) {
    return sendError(
      res,
      500,
      'youtube_oauth_not_configured',
      'YouTube OAuth is not configured',
      { missing_env: youtubeOAuthMissingConfig() }
    );
  }
  const authHeader = req.headers.authorization || '';
  const headerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const queryToken = typeof req.query.token === 'string' ? req.query.token : null;
  const userId = getUserIdFromToken(headerToken) || getUserIdFromToken(queryToken);
  if (!userId) {
    return sendError(res, 401, 'unauthorized', 'Missing bearer token');
  }
  const state = jwt.sign(
    { user_id: userId, provider: 'youtube', nonce: crypto.randomUUID() },
    JWT_SECRET,
    { expiresIn: '10m' }
  );
  return res.redirect(buildYoutubeAuthUrl(state));
});

app.get('/auth/youtube/callback', async (req, res) => {
  if (!youtubeOAuthConfigured()) {
    return sendError(
      res,
      500,
      'youtube_oauth_not_configured',
      'YouTube OAuth is not configured',
      { missing_env: youtubeOAuthMissingConfig() }
    );
  }

  const { code, state, error } = req.query;
  if (error) {
    return sendError(res, 400, 'youtube_auth_failed', `YouTube auth failed: ${error}`);
  }
  if (!code || !state) {
    return sendError(res, 400, 'invalid_request', 'Missing code or state');
  }

  let payload;
  try {
    payload = jwt.verify(state, JWT_SECRET);
  } catch {
    return sendError(res, 400, 'invalid_state', 'Invalid or expired state');
  }

  try {
    const body = new URLSearchParams({
      code: String(code),
      client_id: YOUTUBE_CLIENT_ID,
      client_secret: YOUTUBE_CLIENT_SECRET,
      redirect_uri: YOUTUBE_REDIRECT_URI,
      grant_type: 'authorization_code'
    });
    const tokenData = await fetchJson('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    });

    const accessToken = tokenData?.access_token || null;
    if (!accessToken) {
      return sendError(res, 502, 'youtube_error', 'YouTube did not return an access token');
    }

    const me = await fetchYoutubeOAuthApiJson(
      'https://www.googleapis.com/youtube/v3/channels?part=snippet,contentDetails&mine=true&maxResults=1',
      accessToken
    );
    const channel = Array.isArray(me?.items) ? me.items[0] : null;
    const channelId = channel?.id || null;
    const channelTitle = channel?.snippet?.title || null;
    const channelUrl = channelId ? buildYoutubeChannelUrl(channelId) : null;
    const avatarUrl = channel?.snippet?.thumbnails?.high?.url
      || channel?.snippet?.thumbnails?.medium?.url
      || channel?.snippet?.thumbnails?.default?.url
      || null;

    const existing = await getYoutubeProfile(payload.user_id);
    const refreshToken = tokenData?.refresh_token || existing?.refresh_token || null;
    if (!refreshToken) {
      return sendError(res, 400, 'youtube_missing_refresh', 'YouTube did not return a refresh token. Remove app access and try again.');
    }

    const expiresAt = new Date(Date.now() + (Number(tokenData?.expires_in || 3600) * 1000));
    await upsertYoutubeOAuthTokens({
      userId: payload.user_id,
      channelId,
      channelTitle,
      channelUrl,
      avatarUrl,
      accessToken,
      refreshToken,
      tokenType: tokenData?.token_type || 'Bearer',
      scope: tokenData?.scope || null,
      expiresAt
    });

    const result = await syncYoutubeOAuthProfile(payload.user_id);
    return res.json({
      linked: true,
      ...result
    });
  } catch (err) {
    console.error('YouTube callback error:', err.message);
    if (isDatabaseConnectionError(err)) {
      return sendError(res, 503, 'database_unavailable', 'Database is currently unavailable');
    }
    return sendError(res, err.status || 500, 'youtube_error', err.message || 'YouTube error');
  }
});

app.get('/auth/youtube/status', requireAuth, asyncHandler(async (req, res) => {
  const row = await getYoutubeProfile(req.user.user_id);
  const mode = row ? (isManualYoutubeConnection(row) ? 'manual' : 'oauth') : null;
  return res.json({
    configured: youtubeConfigured(),
    api_configured: youtubeApiConfigured(),
    oauth_configured: youtubeOAuthConfigured(),
    linked: Boolean(row),
    mode,
    channel_id: row?.channel_id || null,
    channel_title: row?.channel_title || null,
    channel_url: row?.channel_url || null,
    avatar_url: row?.avatar_url || null,
    last_synced_at: row?.last_synced_at || null
  });
}));

app.post('/auth/youtube/connect', requireAuth, async (req, res) => {
  const schema = z.object({
    profile: z.string().min(1)
  });
  const parsed = schema.safeParse(req.body || {});
  if (!parsed.success) {
    return sendError(res, 400, 'invalid_body', 'Invalid request body', parsed.error.flatten());
  }

  try {
    const result = await syncYoutubeProfile(req.user.user_id, parsed.data.profile);
    await markYoutubeManualConnection(req.user.user_id);
    return res.json({
      linked: true,
      ...result
    });
  } catch (err) {
    console.error('YouTube connect error:', err.message);
    if (isDatabaseConnectionError(err)) {
      return sendError(res, 503, 'database_unavailable', 'Database is currently unavailable');
    }
    return sendError(res, err.status || 500, 'youtube_error', err.message || 'YouTube error');
  }
});

app.post('/auth/youtube/sync', requireAuth, async (req, res) => {
  try {
    const result = await syncYoutubeProfileAuto(req.user.user_id);
    if (!result.synced) {
      return sendError(res, 400, 'youtube_not_linked', 'YouTube account not linked');
    }
    return res.json(result);
  } catch (err) {
    console.error('YouTube sync error:', err.message);
    if (isDatabaseConnectionError(err)) {
      return sendError(res, 503, 'database_unavailable', 'Database is currently unavailable');
    }
    return sendError(res, err.status || 500, 'youtube_error', err.message || 'YouTube error');
  }
});

app.get('/auth/youtube/profile', requireAuth, asyncHandler(async (req, res) => {
  const row = await getYoutubeProfile(req.user.user_id);
  if (!row) {
    return sendError(res, 404, 'youtube_not_linked', 'YouTube account not linked');
  }
  return res.json({
    mode: isManualYoutubeConnection(row) ? 'manual' : 'oauth',
    channel_id: row.channel_id || null,
    channel_title: row.channel_title || null,
    channel_url: row.channel_url || null,
    avatar_url: row.avatar_url || null,
    top_artists: parseJsonField(row.top_artists),
    top_genres: parseJsonField(row.top_genres),
    last_synced_at: row.last_synced_at
  });
}));

app.delete('/auth/youtube/disconnect', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM user_youtube WHERE user_id = ?', [req.user.user_id]);
    return res.json({ linked: false });
  } catch (err) {
    console.error('YouTube disconnect error:', err.message);
    if (isDatabaseConnectionError(err)) {
      return sendError(res, 503, 'database_unavailable', 'Database is currently unavailable');
    }
    return sendError(res, 500, 'youtube_error', 'Failed to disconnect YouTube');
  }
});

app.get('/auth/preferences', requireAuth, asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT preferred_genres, preferred_artists, preferred_cities, preferred_venues,
            preferred_djs, budget_max, radius_km, night_preferences, updated_at
     FROM user_preferences WHERE user_id = ?`,
    [req.user.user_id]
  );
  if (rows.length === 0) {
    return res.json({
      preferred_genres: [],
      preferred_artists: [],
      preferred_cities: [],
      preferred_venues: [],
      preferred_djs: [],
      budget_max: null,
      radius_km: null,
      night_preferences: [],
      updated_at: null
    });
  }
  const parseJson = (value, fallback = []) => {
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  };
  const row = rows[0];
  return res.json({
    preferred_genres: parseJson(row.preferred_genres),
    preferred_artists: parseJson(row.preferred_artists),
    preferred_cities: parseJson(row.preferred_cities),
    preferred_venues: parseJson(row.preferred_venues),
    preferred_djs: parseJson(row.preferred_djs),
    budget_max: row.budget_max === null ? null : Number(row.budget_max),
    radius_km: row.radius_km === null ? null : Number(row.radius_km),
    night_preferences: parseJson(row.night_preferences),
    updated_at: row.updated_at
  });
}));

app.post('/auth/preferences', requireAuth, asyncHandler(async (req, res) => {
  const schema = z.object({
    preferred_genres: z.array(z.string()).optional(),
    preferred_artists: z.array(z.string()).optional(),
    preferred_cities: z.array(z.string()).optional(),
    preferred_venues: z.array(z.string()).optional(),
    preferred_djs: z.array(z.string()).optional(),
    budget_max: z.coerce.number().nonnegative().optional(),
    radius_km: z.coerce.number().int().positive().optional(),
    night_preferences: z.array(z.string()).optional()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return sendError(res, 400, 'invalid_body', 'Invalid request body', parsed.error.flatten());
  }
  const preferredGenres = parsed.data.preferred_genres || [];
  const preferredArtists = parsed.data.preferred_artists || [];
  const preferredCities = parsed.data.preferred_cities || [];
  const preferredVenues = parsed.data.preferred_venues || [];
  const preferredDjs = parsed.data.preferred_djs || [];
  const budgetMax = parsed.data.budget_max ?? null;
  const radiusKm = parsed.data.radius_km ?? null;
  const nightPreferences = parsed.data.night_preferences || [];
  await pool.query(
    `INSERT INTO user_preferences
      (user_id, preferred_genres, preferred_artists, preferred_cities, preferred_venues,
       preferred_djs, budget_max, radius_km, night_preferences)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       preferred_genres = VALUES(preferred_genres),
       preferred_artists = VALUES(preferred_artists),
       preferred_cities = VALUES(preferred_cities),
       preferred_venues = VALUES(preferred_venues),
       preferred_djs = VALUES(preferred_djs),
       budget_max = VALUES(budget_max),
       radius_km = VALUES(radius_km),
       night_preferences = VALUES(night_preferences),
       updated_at = CURRENT_TIMESTAMP`,
    [
      req.user.user_id,
      JSON.stringify(preferredGenres),
      JSON.stringify(preferredArtists),
      JSON.stringify(preferredCities),
      JSON.stringify(preferredVenues),
      JSON.stringify(preferredDjs),
      budgetMax,
      radiusKm,
      JSON.stringify(nightPreferences)
    ]
  );
  return res.status(200).json({ saved: true });
}));

// A simple health check endpoint
app.get('/', (req, res) => {
  res.send('Authentication API is running');
});
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});
app.get('/ready', asyncHandler(async (req, res) => {
  await pool.query('SELECT 1');
  return res.status(200).json({ status: 'ok' });
}));

// Password reset endpoint
app.post('/auth/reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) {
      return sendError(res, 400, 'missing_fields', 'Email and new password are required');
    }
    const [users] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return sendError(res, 404, 'user_not_found', 'No account found with that email');
    }
    const bcrypt = require('bcryptjs');
    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.execute('UPDATE users SET password_hash = ? WHERE email = ?', [hashed, email]);
    return res.status(200).json({ success: true, message: 'Password has been reset successfully' });
  } catch (err) {
    console.error('Password reset error:', err);
    return handleRouteError(res, err, 'Failed to reset password');
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  return handleRouteError(res, err, 'Server error');
});

// Start the server
if (require.main === module) {
  app.listen(port, () => {
    console.log(`${SERVICE_NAME} listening on port ${port}`);
  });
}

module.exports = { app, pool };
