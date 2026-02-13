const express = require('express');
const axios = require('axios');
const cors = require('cors');
const crypto = require('crypto');
const { z } = require('zod');
const rateLimit = require('express-rate-limit');

const app = express();
app.use(express.json());

const SERVICE_NAME = 'aggregator-service';

const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(v => v.trim())
  : '*';
app.use(cors({
  origin: corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: false
}));

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

if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}

const rateLimiter = rateLimit({
  windowMs: parseIntOrDefault(process.env.RATE_LIMIT_WINDOW_MS, 60_000),
  max: parseIntOrDefault(process.env.RATE_LIMIT_MAX, 60),
  standardHeaders: true,
  legacyHeaders: false
});

if (process.env.NODE_ENV !== 'test') {
  app.use(rateLimiter);
}

const PORT = process.env.PORT || process.env.AGGREGATOR_PORT || 4000;
const TICKETMASTER_API_KEY = process.env.TICKETMASTER_API_KEY;
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';
const VENUE_SERVICE_URL = process.env.VENUE_SERVICE_URL || 'http://venue-service:4001';
const DJ_SERVICE_URL = process.env.DJ_SERVICE_URL || 'http://dj-service:4002';
const LOCAL_EVENTS_URL = process.env.LOCAL_EVENTS_URL || 'http://events-service:4003';
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://ml-service:4004';

const warnOnMissingEnv = () => {
  const warnings = [];
  if (!VENUE_SERVICE_URL) warnings.push('VENUE_SERVICE_URL not set');
  if (!DJ_SERVICE_URL) warnings.push('DJ_SERVICE_URL not set');
  if (!LOCAL_EVENTS_URL) warnings.push('LOCAL_EVENTS_URL not set');
  if (!TICKETMASTER_API_KEY) warnings.push('TICKETMASTER_API_KEY not set (Ticketmaster feed may be limited)');
  if (!warnings.length) return;
  const message = `[${SERVICE_NAME}] ${warnings.join(' | ')}`;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(message);
  }
  console.warn(message);
};

warnOnMissingEnv();

const http = axios.create({ timeout: 8000 });

const calculatePopularityScore = (gig, venues, djs) => {
  let score = 0;
  if (gig.venue) {
    const venue = venues.find(v => gig.venue.includes(v.name));
    if (venue) score += 10;
  }
  if (Array.isArray(gig.djs)) {
    gig.djs.forEach(dj => {
      const djMatch = djs.find(d => d.dj_name.toLowerCase() === dj.toLowerCase());
      if (djMatch) {
        score += 10;
        score += parseInt(djMatch.numeric_fee || 0);
        score += djMatch.total_social_score || 0;
      }
    });
  }
  return score;
};

const normalize = str => (str ?? '').toString().toLowerCase().trim();

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

const proxyRequest = async (req, res, { url, method = 'get' }) => {
  try {
    const response = await http.request({
      url,
      method,
      params: req.query,
      data: req.body,
      headers: {
        Authorization: req.headers.authorization || ''
      }
    });
    return res.status(response.status).json(response.data);
  } catch (error) {
    const status = error.response?.status || 502;
    const message = error.response?.data?.error?.message || error.message || 'Upstream request failed';
    return sendError(res, status, 'upstream_error', message);
  }
};

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

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

// ─── Auth service proxy ───
app.post('/v1/auth/signup', (req, res) => proxyRequest(req, res, { url: `${AUTH_SERVICE_URL}/auth/signup`, method: 'post' }));
app.post('/v1/auth/login', (req, res) => proxyRequest(req, res, { url: `${AUTH_SERVICE_URL}/auth/login`, method: 'post' }));
app.get('/v1/auth/spotify/login', (req, res) => proxyRequest(req, res, { url: `${AUTH_SERVICE_URL}/auth/spotify/login` }));
app.get('/v1/auth/spotify/callback', (req, res) => proxyRequest(req, res, { url: `${AUTH_SERVICE_URL}/auth/spotify/callback` }));
app.get('/v1/auth/spotify/status', (req, res) => proxyRequest(req, res, { url: `${AUTH_SERVICE_URL}/auth/spotify/status` }));
app.post('/v1/auth/spotify/sync', (req, res) => proxyRequest(req, res, { url: `${AUTH_SERVICE_URL}/auth/spotify/sync`, method: 'post' }));
app.get('/v1/auth/spotify/profile', (req, res) => proxyRequest(req, res, { url: `${AUTH_SERVICE_URL}/auth/spotify/profile` }));
app.get('/v1/auth/preferences', (req, res) => proxyRequest(req, res, { url: `${AUTH_SERVICE_URL}/auth/preferences` }));
app.post('/v1/auth/preferences', (req, res) => proxyRequest(req, res, { url: `${AUTH_SERVICE_URL}/auth/preferences`, method: 'post' }));

// ─── ML service proxy ───
app.get('/v1/ml/health', (req, res) => proxyRequest(req, res, { url: `${ML_SERVICE_URL}/health` }));
app.get('/v1/ml/recommendations/:userId', (req, res) => proxyRequest(req, res, { url: `${ML_SERVICE_URL}/recommendations/${req.params.userId}` }));

app.get('/v1/events/search', async (req, res) => {
  try {
    const response = await http.get(
      `${LOCAL_EVENTS_URL}/v1/events/search`,
      { params: req.query, headers: { Authorization: req.headers.authorization || '' } }
    );
    return res.json(response.data);
  } catch (error) {
    console.error('Error proxying /v1/events/search:', error.message);
    return sendError(res, 502, 'upstream_error', 'Failed to fetch events');
  }
});

app.get('/v1/events/:id', async (req, res) => {
  try {
    const response = await http.get(`${LOCAL_EVENTS_URL}/v1/events/${req.params.id}`);
    return res.json(response.data);
  } catch (error) {
    const status = error.response?.status || 502;
    return sendError(res, status, 'upstream_error', 'Failed to fetch event');
  }
});

app.get('/v1/events/:id/calendar', async (req, res) => {
  try {
    const response = await http.get(`${LOCAL_EVENTS_URL}/v1/events/${req.params.id}/calendar`, {
      responseType: 'text'
    });
    res.set('Content-Type', response.headers['content-type'] || 'text/calendar; charset=utf-8');
    if (response.headers['content-disposition']) {
      res.set('Content-Disposition', response.headers['content-disposition']);
    }
    return res.status(response.status).send(response.data);
  } catch (error) {
    const status = error.response?.status || 502;
    return sendError(res, status, 'upstream_error', 'Failed to fetch calendar');
  }
});

app.post('/v1/events/:id/save', async (req, res) => {
  try {
    const response = await http.post(
      `${LOCAL_EVENTS_URL}/v1/events/${req.params.id}/save`,
      {},
      { headers: { Authorization: req.headers.authorization || '' } }
    );
    return res.status(response.status).json(response.data);
  } catch (error) {
    const status = error.response?.status || 502;
    return sendError(res, status, 'upstream_error', 'Failed to save event');
  }
});

app.post('/v1/events/:id/hide', async (req, res) => {
  try {
    const response = await http.post(
      `${LOCAL_EVENTS_URL}/v1/events/${req.params.id}/hide`,
      {},
      { headers: { Authorization: req.headers.authorization || '' } }
    );
    return res.status(response.status).json(response.data);
  } catch (error) {
    const status = error.response?.status || 502;
    return sendError(res, status, 'upstream_error', 'Failed to hide event');
  }
});

app.delete('/v1/events/:id/hide', async (req, res) => {
  try {
    const response = await http.delete(
      `${LOCAL_EVENTS_URL}/v1/events/${req.params.id}/hide`,
      { headers: { Authorization: req.headers.authorization || '' } }
    );
    return res.status(response.status).json(response.data);
  } catch (error) {
    const status = error.response?.status || 502;
    return sendError(res, status, 'upstream_error', 'Failed to unhide event');
  }
});

app.get('/v1/performers', async (req, res) => {
  try {
    const response = await http.get(
      `${LOCAL_EVENTS_URL}/v1/performers`,
      { params: req.query, headers: { Authorization: req.headers.authorization || '' } }
    );
    return res.status(response.status).json(response.data);
  } catch (error) {
    const status = error.response?.status || 502;
    return sendError(res, status, 'upstream_error', 'Failed to fetch performers');
  }
});

app.get('/v1/alerts', async (req, res) => proxyRequest(req, res, { url: `${LOCAL_EVENTS_URL}/v1/alerts` }));
app.post('/v1/alerts', async (req, res) => proxyRequest(req, res, { url: `${LOCAL_EVENTS_URL}/v1/alerts`, method: 'post' }));
app.delete('/v1/alerts/:id', async (req, res) => proxyRequest(req, res, { url: `${LOCAL_EVENTS_URL}/v1/alerts/${req.params.id}`, method: 'delete' }));
app.get('/v1/alerts/notifications', async (req, res) => proxyRequest(req, res, { url: `${LOCAL_EVENTS_URL}/v1/alerts/notifications` }));

app.get('/v1/users/me/feed', async (req, res) => {
  try {
    const response = await http.get(
      `${LOCAL_EVENTS_URL}/v1/users/me/feed`,
      { params: req.query, headers: { Authorization: req.headers.authorization || '' } }
    );
    return res.status(response.status).json(response.data);
  } catch (error) {
    const status = error.response?.status || 502;
    return sendError(res, status, 'upstream_error', 'Failed to fetch feed');
  }
});

app.get('/v1/users/me/saved', async (req, res) => {
  try {
    const response = await http.get(
      `${LOCAL_EVENTS_URL}/v1/users/me/saved`,
      { headers: { Authorization: req.headers.authorization || '' } }
    );
    return res.status(response.status).json(response.data);
  } catch (error) {
    const status = error.response?.status || 502;
    return sendError(res, status, 'upstream_error', 'Failed to fetch saved events');
  }
});

app.get('/v1/users/me/hidden', async (req, res) => {
  try {
    const response = await http.get(
      `${LOCAL_EVENTS_URL}/v1/users/me/hidden`,
      { headers: { Authorization: req.headers.authorization || '' } }
    );
    return res.status(response.status).json(response.data);
  } catch (error) {
    const status = error.response?.status || 502;
    return sendError(res, status, 'upstream_error', 'Failed to fetch hidden events');
  }
});

app.get('/v1/users/me/calendar', async (req, res) => {
  try {
    const response = await http.get(
      `${LOCAL_EVENTS_URL}/v1/users/me/calendar`,
      { params: req.query, headers: { Authorization: req.headers.authorization || '' }, responseType: 'text' }
    );
    res.set('Content-Type', response.headers['content-type'] || 'text/calendar; charset=utf-8');
    if (response.headers['content-disposition']) {
      res.set('Content-Disposition', response.headers['content-disposition']);
    }
    return res.status(response.status).send(response.data);
  } catch (error) {
    const status = error.response?.status || 502;
    return sendError(res, status, 'upstream_error', 'Failed to fetch calendar');
  }
});

app.get('/v1/organizer/plans', async (req, res) => proxyRequest(req, res, { url: `${LOCAL_EVENTS_URL}/v1/organizer/plans` }));
app.post('/v1/organizer/plans', async (req, res) => proxyRequest(req, res, { url: `${LOCAL_EVENTS_URL}/v1/organizer/plans`, method: 'post' }));
app.get('/v1/organizer/plans/:id', async (req, res) => proxyRequest(req, res, { url: `${LOCAL_EVENTS_URL}/v1/organizer/plans/${req.params.id}` }));
app.put('/v1/organizer/plans/:id', async (req, res) => proxyRequest(req, res, { url: `${LOCAL_EVENTS_URL}/v1/organizer/plans/${req.params.id}`, method: 'put' }));
app.post('/v1/organizer/plans/:id/search/djs', async (req, res) => proxyRequest(req, res, { url: `${LOCAL_EVENTS_URL}/v1/organizer/plans/${req.params.id}/search/djs`, method: 'post' }));
app.post('/v1/organizer/plans/:id/search/venues', async (req, res) => proxyRequest(req, res, { url: `${LOCAL_EVENTS_URL}/v1/organizer/plans/${req.params.id}/search/venues`, method: 'post' }));
app.post('/v1/organizer/plans/:id/shortlist', async (req, res) => proxyRequest(req, res, { url: `${LOCAL_EVENTS_URL}/v1/organizer/plans/${req.params.id}/shortlist`, method: 'post' }));
app.get('/v1/organizer/plans/:id/shortlist', async (req, res) => proxyRequest(req, res, { url: `${LOCAL_EVENTS_URL}/v1/organizer/plans/${req.params.id}/shortlist` }));

app.get('/v1/organizer/contact-templates', async (req, res) => {
  try {
    const response = await http.get(
      `${LOCAL_EVENTS_URL}/v1/organizer/contact-templates`,
      { headers: { Authorization: req.headers.authorization || '' } }
    );
    return res.status(response.status).json(response.data);
  } catch (error) {
    const status = error.response?.status || 502;
    return sendError(res, status, 'upstream_error', 'Failed to fetch contact templates');
  }
});

app.post('/v1/organizer/contact-requests', async (req, res) => proxyRequest(req, res, { url: `${LOCAL_EVENTS_URL}/v1/organizer/contact-requests`, method: 'post' }));
app.get('/v1/organizer/contact-requests', async (req, res) => proxyRequest(req, res, { url: `${LOCAL_EVENTS_URL}/v1/organizer/contact-requests` }));

app.get('/v1/organizer/plans/:id/shortlist/export', async (req, res) => {
  try {
    const response = await http.get(
      `${LOCAL_EVENTS_URL}/v1/organizer/plans/${req.params.id}/shortlist/export`,
      { params: req.query, headers: { Authorization: req.headers.authorization || '' }, responseType: 'text' }
    );
    res.set('Content-Type', response.headers['content-type'] || 'text/csv; charset=utf-8');
    if (response.headers['content-disposition']) {
      res.set('Content-Disposition', response.headers['content-disposition']);
    }
    return res.status(response.status).send(response.data);
  } catch (error) {
    const status = error.response?.status || 502;
    return sendError(res, status, 'upstream_error', 'Failed to export shortlist');
  }
});

app.get('/events', (req, res) => proxyRequest(req, res, { url: `${LOCAL_EVENTS_URL}/events` }));
app.get('/events/:id', (req, res) => proxyRequest(req, res, { url: `${LOCAL_EVENTS_URL}/events/${req.params.id}` }));
app.post('/events', (req, res) => proxyRequest(req, res, { url: `${LOCAL_EVENTS_URL}/events`, method: 'post' }));
app.put('/events/:id', (req, res) => proxyRequest(req, res, { url: `${LOCAL_EVENTS_URL}/events/${req.params.id}`, method: 'put' }));
app.delete('/events/:id', (req, res) => proxyRequest(req, res, { url: `${LOCAL_EVENTS_URL}/events/${req.params.id}`, method: 'delete' }));

app.get('/djs', (req, res) => proxyRequest(req, res, { url: `${DJ_SERVICE_URL}/djs` }));
app.get('/djs/:dj_id', (req, res) => proxyRequest(req, res, { url: `${DJ_SERVICE_URL}/djs/${req.params.dj_id}` }));
app.get('/v1/djs/search', (req, res) => proxyRequest(req, res, { url: `${DJ_SERVICE_URL}/v1/djs/search` }));
app.post('/djs', (req, res) => proxyRequest(req, res, { url: `${DJ_SERVICE_URL}/djs`, method: 'post' }));
app.put('/djs/:dj_id', (req, res) => proxyRequest(req, res, { url: `${DJ_SERVICE_URL}/djs/${req.params.dj_id}`, method: 'put' }));
app.delete('/djs/:dj_id', (req, res) => proxyRequest(req, res, { url: `${DJ_SERVICE_URL}/djs/${req.params.dj_id}`, method: 'delete' }));

app.get('/venues', (req, res) => proxyRequest(req, res, { url: `${VENUE_SERVICE_URL}/venues` }));
app.get('/venues/:id', (req, res) => proxyRequest(req, res, { url: `${VENUE_SERVICE_URL}/venues/${req.params.id}` }));
app.get('/v1/venues/search', (req, res) => proxyRequest(req, res, { url: `${VENUE_SERVICE_URL}/v1/venues/search` }));
app.get('/v1/venues/:id/availability', (req, res) => proxyRequest(req, res, { url: `${VENUE_SERVICE_URL}/v1/venues/${req.params.id}/availability` }));
app.post('/v1/venues/:id/availability', (req, res) => proxyRequest(req, res, { url: `${VENUE_SERVICE_URL}/v1/venues/${req.params.id}/availability`, method: 'post' }));
app.delete('/v1/venues/:id/availability/:availability_id', (req, res) => proxyRequest(req, res, { url: `${VENUE_SERVICE_URL}/v1/venues/${req.params.id}/availability/${req.params.availability_id}`, method: 'delete' }));
app.post('/venues', (req, res) => proxyRequest(req, res, { url: `${VENUE_SERVICE_URL}/venues`, method: 'post' }));
app.put('/venues/:id', (req, res) => proxyRequest(req, res, { url: `${VENUE_SERVICE_URL}/venues/${req.params.id}`, method: 'put' }));
app.delete('/venues/:id', (req, res) => proxyRequest(req, res, { url: `${VENUE_SERVICE_URL}/venues/${req.params.id}`, method: 'delete' }));

app.get('/api/gigs', async (req, res) => {
  try {
    const querySchema = z.object({
      city: z.string().min(1).optional(),
      genre: z.string().min(1).optional(),
      djName: z.string().min(1).optional(),
      venue: z.string().min(1).optional()
    });
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      return sendError(res, 400, 'invalid_query', 'Invalid query parameters', parsed.error.flatten());
    }

    const [venuesRes, djsRes] = await Promise.allSettled([
      http.get(`${VENUE_SERVICE_URL}/venues`),
      http.get(`${DJ_SERVICE_URL}/djs`)
    ]);

    const venues = venuesRes.status === 'fulfilled' ? venuesRes.value.data : [];
    const djs = djsRes.status === 'fulfilled' ? djsRes.value.data : [];

    if (venuesRes.status !== 'fulfilled') {
      console.warn('Venue service unavailable:', venuesRes.reason?.message);
    }
    if (djsRes.status !== 'fulfilled') {
      console.warn('DJ service unavailable:', djsRes.reason?.message);
    }

    const city = parsed.data.city || 'Dublin';
    const genre = normalize(parsed.data.genre);
    const djName = normalize(parsed.data.djName);
    const venueName = normalize(parsed.data.venue);

    let tmEvents = [];
    if (TICKETMASTER_API_KEY) {
      try {
        const tmUrl = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TICKETMASTER_API_KEY}&city=${city}${genre ? `&classificationName=${genre}` : ''}`;
        const tmRes = await http.get(tmUrl);
        tmEvents = tmRes.data._embedded?.events || [];
      } catch (err) {
        if (err.response?.status === 429) {
          console.warn('Ticketmaster API rate limit reached.');
        } else {
          console.warn('Ticketmaster API error:', err.message);
        }
      }
    } else {
      console.warn('TICKETMASTER_API_KEY not set; skipping Ticketmaster fetch.');
    }

    const formattedTMEvents = tmEvents.map(event => {
      const eventName = event.name;
      const venueNameTM = event._embedded?.venues?.[0]?.name || 'Unknown Venue';
      const matchedVenue = venues.find(v => normalize(venueNameTM).includes(normalize(v.name)));
      const matchedDJs = djs.filter(dj =>
        normalize(eventName).includes(normalize(dj.dj_name)) ||
        normalize(dj.dj_name).includes(normalize(eventName))
      );

      const formatted = {
        eventName,
        date: event.dates?.start?.localDate || 'N/A',
        time: event.dates?.start?.localTime || 'N/A',
        venue: matchedVenue ? matchedVenue.name : venueNameTM,
        address: matchedVenue ? matchedVenue.address : 'N/A',
        djs: matchedDJs.map(dj => dj.dj_name),
        ticketLink: event.url,
        isLocal: false,
        source: 'Ticketmaster'
      };
      formatted.popularityScore = calculatePopularityScore(formatted, venues, djs);
      return formatted;
    });

    let localRawEvents = [];
    try {
      localRawEvents = (await http.get(`${LOCAL_EVENTS_URL}/events`)).data;
    } catch (err) {
      console.warn('Local events service unavailable:', err.message);
    }

    const formattedLocalEvents = localRawEvents.map(ev => {
      const matchedVenue = venues.find(v => normalize(ev.venue_name || '').includes(normalize(v.name)));
      const matchedDJs = djs.filter(dj =>
        normalize(ev.event_name).includes(normalize(dj.dj_name)) ||
        normalize(dj.dj_name).includes(normalize(ev.event_name))
      );

      const formatted = {
        eventName: ev.event_name || 'N/A',
        date: ev.date_local || 'N/A',
        time: ev.time_local || 'N/A',
        venue: ev.venue_name || 'Unknown Venue',
        address: matchedVenue ? matchedVenue.address : 'N/A',
        djs: matchedDJs.map(d => d.dj_name),
        ticketLink: ev.url || '#',
        isLocal: true,
        source: 'Local'
      };
      formatted.popularityScore = calculatePopularityScore(formatted, venues, djs);
      return formatted;
    });

    const matchesFilters = (event) => {
      let matches = true;
      if (djName) {
        matches = matches && event.djs.some(d => normalize(d).includes(djName));
      }
      if (venueName) {
        matches = matches && normalize(event.venue).includes(venueName);
      }
      if (genre) {
        matches = matches && normalize(event.eventName).includes(genre);
      }
      return matches;
    };

    const filteredTMEvents = formattedTMEvents.filter(matchesFilters);
    const filteredLocalEvents = formattedLocalEvents.filter(matchesFilters);

    const finalEvents = (filteredTMEvents.length > 0)
      ? [...filteredTMEvents.sort((a, b) => b.popularityScore - a.popularityScore),
         ...filteredLocalEvents.sort((a, b) => b.popularityScore - a.popularityScore)]
      : [...filteredLocalEvents.sort((a, b) => b.popularityScore - a.popularityScore),
         ...filteredTMEvents.sort((a, b) => b.popularityScore - a.popularityScore)];

    return res.json({ gigs: finalEvents });

  } catch (error) {
    console.error('Error fetching gigs:', error.message);
    return sendError(res, 500, 'internal_error', 'Failed to fetch gigs');
  }
});

if (require.main === module) {
  app.listen(PORT, () => console.log(`${SERVICE_NAME} listening on port ${PORT}`));
}

module.exports = { app };
