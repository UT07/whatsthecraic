const axios = require('axios');

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

let cachedToken = null;
let tokenExpiresAt = 0;

// In-memory cache with TTL
const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Rate limiting queue
const rateLimiter = {
  queue: [],
  processing: false,
  minDelay: 200, // Minimum 200ms between requests (5 req/sec max)
  lastRequestTime: 0,
  retryDelays: [1000, 2000, 5000, 10000], // Exponential backoff

  async add(fn, retryCount = 0) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject, retryCount });
      this.process();
    });
  },

  async process() {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    const { fn, resolve, reject, retryCount } = this.queue.shift();

    try {
      // Enforce minimum delay between requests
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.minDelay) {
        await new Promise(r => setTimeout(r, this.minDelay - timeSinceLastRequest));
      }

      this.lastRequestTime = Date.now();
      const result = await fn();
      resolve(result);
    } catch (error) {
      // Handle 429 rate limiting with exponential backoff
      if (error.response?.status === 429 && retryCount < this.retryDelays.length) {
        const delay = this.retryDelays[retryCount];
        console.warn(`[Spotify] Rate limited, retrying in ${delay}ms (attempt ${retryCount + 1})`);

        setTimeout(() => {
          this.queue.unshift({ fn, resolve, reject, retryCount: retryCount + 1 });
          this.processing = false;
          this.process();
        }, delay);
        return;
      }
      reject(error);
    }

    // Process next request
    setTimeout(() => {
      this.processing = false;
      this.process();
    }, this.minDelay);
  }
};

/**
 * Get from cache or execute function and cache result
 */
const withCache = async (key, ttl, fn) => {
  // Check cache
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.value;
  }

  // Execute and cache
  const value = await fn();
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttl
  });

  // Clean up expired entries periodically
  if (cache.size > 1000) {
    const now = Date.now();
    for (const [k, v] of cache.entries()) {
      if (now >= v.expiresAt) {
        cache.delete(k);
      }
    }
  }

  return value;
};

const getAccessToken = async (clientId, clientSecret) => {
  if (cachedToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  const response = await axios.post(SPOTIFY_TOKEN_URL,
    new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      auth: { username: clientId, password: clientSecret },
      timeout: 10000
    }
  );

  cachedToken = response.data.access_token;
  tokenExpiresAt = Date.now() + (response.data.expires_in * 1000);
  return cachedToken;
};

const makeRequest = async (clientId, clientSecret, path, params = {}) => {
  const cacheKey = `spotify:${path}:${JSON.stringify(params)}`;

  return withCache(cacheKey, CACHE_TTL, async () => {
    return rateLimiter.add(async () => {
      const token = await getAccessToken(clientId, clientSecret);
      const response = await axios.get(`${SPOTIFY_API_BASE}${path}`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
        timeout: 10000
      });
      return response.data;
    });
  });
};

/**
 * Search for artists on Spotify (cached + rate limited)
 * @returns {Array} [{name, id, genres, popularity, followers, image, spotifyUrl}]
 */
const searchArtists = async (clientId, clientSecret, query, limit = 20) => {
  const data = await makeRequest(clientId, clientSecret, '/search', {
    q: query,
    type: 'artist',
    limit: Math.min(limit, 50)
  });

  return (data.artists?.items || []).map(a => ({
    name: a.name,
    spotifyId: a.id,
    genres: a.genres || [],
    popularity: a.popularity || 0,
    followers: a.followers?.total || 0,
    image: a.images?.[0]?.url || null,
    images: (a.images || []).map(img => ({ url: img.url, width: img.width, height: img.height })),
    spotifyUrl: a.external_urls?.spotify || null
  }));
};

/**
 * Get a single artist by Spotify ID (cached + rate limited)
 */
const getArtist = async (clientId, clientSecret, artistId) => {
  const a = await makeRequest(clientId, clientSecret, `/artists/${artistId}`);
  return {
    name: a.name,
    spotifyId: a.id,
    genres: a.genres || [],
    popularity: a.popularity || 0,
    followers: a.followers?.total || 0,
    image: a.images?.[0]?.url || null,
    images: (a.images || []).map(img => ({ url: img.url, width: img.width, height: img.height })),
    spotifyUrl: a.external_urls?.spotify || null
  };
};

/**
 * Get related artists for discovery (cached + rate limited)
 */
const getRelatedArtists = async (clientId, clientSecret, artistId, limit = 10) => {
  const data = await makeRequest(clientId, clientSecret, `/artists/${artistId}/related-artists`);
  return (data.artists || []).slice(0, limit).map(a => ({
    name: a.name,
    spotifyId: a.id,
    genres: a.genres || [],
    popularity: a.popularity || 0,
    followers: a.followers?.total || 0,
    image: a.images?.[0]?.url || null,
    spotifyUrl: a.external_urls?.spotify || null
  }));
};

/**
 * Get artist top tracks (cached + rate limited)
 */
const getTopTracks = async (clientId, clientSecret, artistId, market = 'IE') => {
  const data = await makeRequest(clientId, clientSecret, `/artists/${artistId}/top-tracks`, { market });
  return (data.tracks || []).map(t => ({
    name: t.name,
    previewUrl: t.preview_url,
    album: t.album?.name,
    albumImage: t.album?.images?.[0]?.url || null,
    durationMs: t.duration_ms,
    popularity: t.popularity
  }));
};

/**
 * Get cache statistics (for monitoring)
 */
const getCacheStats = () => {
  const now = Date.now();
  let validEntries = 0;
  let expiredEntries = 0;

  for (const [, v] of cache.entries()) {
    if (now < v.expiresAt) {
      validEntries++;
    } else {
      expiredEntries++;
    }
  }

  return {
    size: cache.size,
    validEntries,
    expiredEntries,
    queueLength: rateLimiter.queue.length,
    isProcessing: rateLimiter.processing
  };
};

module.exports = {
  getAccessToken,
  searchArtists,
  getArtist,
  getRelatedArtists,
  getTopTracks,
  getCacheStats
};
