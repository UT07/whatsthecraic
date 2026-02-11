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
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const ensureAuthSchema = async () => {
  try {
    const [rows] = await pool.query("SHOW COLUMNS FROM users LIKE 'role'");
    if (rows.length === 0) {
      await pool.query("ALTER TABLE users ADD COLUMN role VARCHAR(32) DEFAULT 'user'");
      console.log('[auth-service] Added users.role column');
    }
  } catch (err) {
    if (err.code !== 'ER_NO_SUCH_TABLE') {
      console.error('[auth-service] Schema check failed:', err.message);
    }
  }
};

void ensureAuthSchema();

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

const spotifyConfigured = () => {
  return Boolean(SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET && SPOTIFY_REDIRECT_URI);
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

const serializeDateTime = (date) => date.toISOString().slice(0, 19).replace('T', ' ');

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

const syncSpotifyProfile = async (userId) => {
  const accessToken = await getValidSpotifyAccessToken(userId);
  if (!accessToken) {
    return { synced: false, reason: 'not_linked' };
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
     SET top_artists = ?, top_genres = ?, last_synced_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`,
    [JSON.stringify(artists), JSON.stringify(topGenres), userId]
  );
  return { synced: true, top_artists: artists, top_genres: topGenres };
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
    return sendError(res, 500, 'internal_error', 'Server error');
  }
});

app.get('/auth/spotify/login', (req, res) => {
  if (!spotifyConfigured()) {
    return sendError(res, 500, 'spotify_not_configured', 'Spotify OAuth is not configured');
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
    return sendError(res, 500, 'spotify_not_configured', 'Spotify OAuth is not configured');
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

    await syncSpotifyProfile(payload.user_id);
    return res.json({ linked: true, spotify_user_id: me.id });
  } catch (err) {
    console.error('Spotify callback error:', err.message);
    return sendError(res, err.status || 500, 'spotify_error', err.message);
  }
});

app.get('/auth/spotify/status', requireAuth, async (req, res) => {
  const row = await getSpotifyTokens(req.user.user_id);
  return res.json({ linked: Boolean(row), last_synced_at: row?.last_synced_at || null });
});

app.post('/auth/spotify/sync', requireAuth, async (req, res) => {
  try {
    const result = await syncSpotifyProfile(req.user.user_id);
    if (!result.synced) {
      return sendError(res, 400, 'spotify_not_linked', 'Spotify account not linked');
    }
    return res.json(result);
  } catch (err) {
    console.error('Spotify sync error:', err.message);
    return sendError(res, err.status || 500, 'spotify_error', err.message);
  }
});

app.get('/auth/spotify/profile', requireAuth, async (req, res) => {
  const [rows] = await pool.query(
    'SELECT top_artists, top_genres, last_synced_at FROM user_spotify WHERE user_id = ?',
    [req.user.user_id]
  );
  if (rows.length === 0) {
    return sendError(res, 404, 'spotify_not_linked', 'Spotify account not linked');
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
    top_artists: parseJson(row.top_artists),
    top_genres: parseJson(row.top_genres),
    last_synced_at: row.last_synced_at
  });
});

app.get('/auth/preferences', requireAuth, async (req, res) => {
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
});

app.post('/auth/preferences', requireAuth, async (req, res) => {
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
if (require.main === module) {
  app.listen(port, () => {
    console.log(`${SERVICE_NAME} listening on port ${port}`);
  });
}

module.exports = { app, pool };
