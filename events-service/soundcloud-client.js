const axios = require('axios');

const SOUNDCLOUD_API = 'https://api-v2.soundcloud.com';
const http = axios.create({ timeout: 10000 });

const cache = new Map();
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

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

const withCache = async (key, fn) => {
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }
  const value = await fn();
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  if (cache.size > 1000) {
    const now = Date.now();
    for (const [entryKey, entry] of cache.entries()) {
      if (entry.expiresAt <= now) cache.delete(entryKey);
    }
  }
  return value;
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
    const response = await http.get(`${SOUNDCLOUD_API}/search/users`, {
      params: {
        q: searchQuery,
        client_id: clientId,
        limit: safeLimit,
        linked_partitioning: 1
      }
    });

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
