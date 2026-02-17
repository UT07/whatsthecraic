const axios = require('axios');

const MIXCLOUD_API = 'https://api.mixcloud.com';
const http = axios.create({ timeout: 10000 });
const cache = new Map();
const inFlight = new Map();
const CACHE_TTL_MS = Number.parseInt(process.env.MIXCLOUD_CACHE_TTL_MS || `${15 * 60 * 1000}`, 10);
const CACHE_STALE_MS = Number.parseInt(process.env.MIXCLOUD_CACHE_STALE_MS || `${5 * 60 * 1000}`, 10);
const RATE_LIMIT_BACKOFF_MS = Number.parseInt(process.env.MIXCLOUD_RATE_LIMIT_BACKOFF_MS || '45000', 10);
const RETRY_ATTEMPTS = Number.parseInt(process.env.MIXCLOUD_RETRY_ATTEMPTS || '2', 10);
const MAX_CACHE_SIZE = 1000;

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
      console.warn(`[mixcloud-client] retrying ${label} in ${waitMs}ms (attempt ${attempt + 1}/${RETRY_ATTEMPTS})`);
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
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.value;

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
        console.warn(`[mixcloud-client] serving stale cache for ${key} due to upstream error`);
        return stale.value;
      }
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

/**
 * Search for DJs/users on Mixcloud
 * @returns {Array} [{name, username, url, image, key}]
 */
const searchDJs = async (query, limit = 20) => {
  const safeLimit = Math.min(limit, 50);
  return withCache(`mixcloud:searchDJs:${(query || '').toLowerCase().trim()}:${safeLimit}`, async () => {
    const response = await requestWithRetry(
      () => http.get(`${MIXCLOUD_API}/search/`, {
        params: { q: query, type: 'user', limit: safeLimit }
      }),
      `search-djs:${(query || '').toLowerCase().trim()}`
    );
    return (response.data?.data || []).map(u => ({
      name: u.name,
      username: u.username,
      key: u.key,
      url: u.url,
      image: u.pictures?.large || u.pictures?.extra_large || u.pictures?.medium || null,
      images: u.pictures || {}
    }));
  });
};

/**
 * Search for cloudcasts (mixes) with genre tags
 * @returns {Array} [{name, user, tags, url, image, audioLength, playCount}]
 */
const searchCloudcasts = async (query, limit = 20) => {
  const safeLimit = Math.min(limit, 50);
  return withCache(`mixcloud:searchCloudcasts:${(query || '').toLowerCase().trim()}:${safeLimit}`, async () => {
    const response = await requestWithRetry(
      () => http.get(`${MIXCLOUD_API}/search/`, {
        params: { q: query, type: 'cloudcast', limit: safeLimit }
      }),
      `search-cloudcasts:${(query || '').toLowerCase().trim()}`
    );
    return (response.data?.data || []).map(c => ({
      name: c.name,
      user: c.user ? { name: c.user.name, username: c.user.username, url: c.user.url } : null,
      tags: (c.tags || []).map(t => t.name || t.key || '').filter(Boolean),
      url: c.url,
      image: c.pictures?.large || c.pictures?.extra_large || null,
      audioLength: c.audio_length,
      playCount: c.play_count || 0,
      createdTime: c.created_time
    }));
  });
};

/**
 * Get a DJ's profile with metadata
 */
const getDJProfile = async (username) => {
  return withCache(`mixcloud:getDJProfile:${(username || '').toLowerCase().trim()}`, async () => {
    const response = await requestWithRetry(
      () => http.get(`${MIXCLOUD_API}/${encodeURIComponent(username)}/`),
      `profile:${(username || '').toLowerCase().trim()}`
    );
    const u = response.data || {};
    return {
      name: u.name,
      username: u.username,
      key: u.key,
      url: u.url,
      bio: u.biog || null,
      city: u.city || null,
      country: u.country || null,
      image: u.pictures?.large || u.pictures?.extra_large || null,
      images: u.pictures || {},
      followerCount: u.follower_count || 0,
      followingCount: u.following_count || 0,
      cloudcastCount: u.cloudcast_count || 0
    };
  });
};

/**
 * Get a DJ's cloudcasts (mixes) for genre extraction
 */
const getDJCloudcasts = async (username, limit = 10) => {
  const safeLimit = Math.min(limit, 50);
  return withCache(`mixcloud:getDJCloudcasts:${(username || '').toLowerCase().trim()}:${safeLimit}`, async () => {
    const response = await requestWithRetry(
      () => http.get(`${MIXCLOUD_API}/${encodeURIComponent(username)}/cloudcasts/`, {
        params: { limit: safeLimit }
      }),
      `cloudcasts:${(username || '').toLowerCase().trim()}`
    );
    return (response.data?.data || []).map(c => ({
      name: c.name,
      tags: (c.tags || []).map(t => t.name || t.key || '').filter(Boolean),
      url: c.url,
      image: c.pictures?.large || null,
      audioLength: c.audio_length,
      playCount: c.play_count || 0,
      createdTime: c.created_time
    }));
  });
};

/**
 * Discover DJs by searching genre tags on Mixcloud
 * Extracts unique DJs from cloudcast results
 */
const discoverDJsByGenre = async (genre, limit = 20) => {
  const cloudcasts = await searchCloudcasts(`${genre} Dublin Ireland`, Math.min(limit * 2, 50));

  const seen = new Map();
  for (const c of cloudcasts) {
    if (c.user && c.user.username && !seen.has(c.user.username)) {
      seen.set(c.user.username, {
        name: c.user.name,
        username: c.user.username,
        url: c.user.url,
        image: null,
        genres: c.tags,
        source: 'mixcloud'
      });
    }
  }

  return Array.from(seen.values()).slice(0, limit);
};

module.exports = {
  searchDJs,
  searchCloudcasts,
  getDJProfile,
  getDJCloudcasts,
  discoverDJsByGenre
};
