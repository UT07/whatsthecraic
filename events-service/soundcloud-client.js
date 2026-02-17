const axios = require('axios');

const SOUNDCLOUD_API = 'https://api-v2.soundcloud.com';
const http = axios.create({ timeout: 10000 });

const cache = new Map();
const inFlight = new Map();
const CACHE_TTL_MS = Number.parseInt(process.env.SOUNDCLOUD_CACHE_TTL_MS || `${12 * 60 * 60 * 1000}`, 10);
const CACHE_STALE_MS = Number.parseInt(process.env.SOUNDCLOUD_CACHE_STALE_MS || `${30 * 60 * 1000}`, 10);
const RATE_LIMIT_BACKOFF_MS = Number.parseInt(process.env.SOUNDCLOUD_RATE_LIMIT_BACKOFF_MS || '60000', 10);
const RETRY_ATTEMPTS = Number.parseInt(process.env.SOUNDCLOUD_RETRY_ATTEMPTS || '2', 10);
const MAX_CACHE_SIZE = 1000;

const normalizeToken = (value) => (value ?? '').toString().toLowerCase().trim();

const dedupe = (items) => {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = normalizeToken(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
};

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

const isRetryableError = (err) => {
  const status = Number(err?.response?.status || 0);
  if (status === 429 || status >= 500) return true;
  return ['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED', 'EAI_AGAIN'].includes(err?.code);
};

const requestWithRetry = async (fn, label) => {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (!isRetryableError(err) || attempt >= RETRY_ATTEMPTS) {
        throw err;
      }
      const retryAfter = parseRetryAfterMs(err?.response?.headers?.['retry-after']);
      const backoff = retryAfter ?? Math.min(RATE_LIMIT_BACKOFF_MS * (attempt + 1), 120000);
      const jitter = Math.floor(Math.random() * 250);
      const waitMs = backoff + jitter;
      console.warn(`[soundcloud-client] retrying ${label} in ${waitMs}ms (attempt ${attempt + 1}/${RETRY_ATTEMPTS})`);
      await sleep(waitMs);
      attempt += 1;
    }
  }
};

const cleanupCache = () => {
  if (cache.size <= MAX_CACHE_SIZE) return;
  const now = Date.now();
  for (const [entryKey, entry] of cache.entries()) {
    if ((entry?.staleUntil || 0) <= now) {
      cache.delete(entryKey);
    }
  }
};

const withCache = async (key, fn) => {
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  if (inFlight.has(key)) {
    return inFlight.get(key);
  }

  const task = fn()
    .then((value) => {
      const createdAt = Date.now();
      cache.set(key, {
        value,
        expiresAt: createdAt + CACHE_TTL_MS,
        staleUntil: createdAt + CACHE_TTL_MS + CACHE_STALE_MS
      });
      cleanupCache();
      return value;
    })
    .catch((err) => {
      const stale = cache.get(key);
      if (stale && stale.staleUntil > Date.now()) {
        console.warn(`[soundcloud-client] serving stale cache for ${key} due to upstream error`);
        return stale.value;
      }

      // Back off aggressively on hard rate-limits to avoid hammering the API.
      if (Number(err?.response?.status) === 429) {
        const holdUntil = Date.now() + RATE_LIMIT_BACKOFF_MS;
        cache.set(key, {
          value: [],
          expiresAt: holdUntil,
          staleUntil: holdUntil
        });
      }
      throw err;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, task);
  return task;
};

const toBestAvatar = (avatarUrl) => {
  if (!avatarUrl) return null;
  // SoundCloud avatar URLs commonly use -large; upgrade when available.
  return avatarUrl.replace('-large.', '-t500x500.');
};

const extractGenreTokens = (user) => {
  const genreFields = [
    user?.genre,
    user?.description,
    user?.track_tags
  ]
    .filter(Boolean)
    .join(' ');

  if (!genreFields) return [];

  return dedupe(
    genreFields
      .split(/[\n,|/#;]+/)
      .map(token => normalizeToken(token))
      .filter(token => token.length >= 3 && token.length <= 40)
  ).slice(0, 8);
};

/**
 * Search SoundCloud users by query.
 * @returns {Promise<Array<{name:string,username:string,url:string,image:string,genres:string[],followers:number,popularity:number,source:string}>>}
 */
const searchUsers = async (clientId, query, limit = 20) => {
  if (!clientId) return [];
  const searchQuery = (query || '').toString().trim();
  if (!searchQuery) return [];

  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 50);
  const cacheKey = `soundcloud:users:${normalizeToken(searchQuery)}:${safeLimit}`;

  return withCache(cacheKey, async () => {
    const response = await requestWithRetry(
      () => http.get(`${SOUNDCLOUD_API}/search/users`, {
        params: {
          q: searchQuery,
          client_id: clientId,
          limit: safeLimit,
          linked_partitioning: 1
        }
      }),
      `search-users:${normalizeToken(searchQuery)}`
    );

    const collection = Array.isArray(response.data?.collection) ? response.data.collection : [];

    return collection
      .map((user) => {
        const displayName = user?.full_name || user?.username || null;
        if (!displayName) return null;
        const genres = extractGenreTokens(user);
        const followers = Number.parseInt(user?.followers_count, 10) || 0;
        const likes = Number.parseInt(user?.likes_count, 10) || 0;
        return {
          name: displayName,
          username: user?.username || null,
          url: user?.permalink_url || null,
          soundcloudUrl: user?.permalink_url || null,
          image: toBestAvatar(user?.avatar_url),
          genres,
          followers,
          popularity: followers + likes,
          source: 'soundcloud'
        };
      })
      .filter(Boolean);
  });
};

module.exports = {
  searchUsers
};
