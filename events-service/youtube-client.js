const axios = require('axios');

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const http = axios.create({ timeout: 10000 });

const cache = new Map();
const inFlight = new Map();
const CACHE_TTL_MS = Number.parseInt(process.env.YOUTUBE_CACHE_TTL_MS || `${15 * 60 * 1000}`, 10);
const CACHE_STALE_MS = Number.parseInt(process.env.YOUTUBE_CACHE_STALE_MS || `${5 * 60 * 1000}`, 10);
const RATE_LIMIT_BACKOFF_MS = Number.parseInt(process.env.YOUTUBE_RATE_LIMIT_BACKOFF_MS || '60000', 10);
const RETRY_ATTEMPTS = Number.parseInt(process.env.YOUTUBE_RETRY_ATTEMPTS || '2', 10);
const MAX_CACHE_SIZE = 1000;

const ORG_KEYWORDS = [
  'records',
  'recordings',
  'record label',
  'label',
  'club',
  'venue',
  'radio',
  'fm',
  'tv',
  'festival',
  'events',
  'promotions',
  'agency',
  'collective',
  'official label',
  'booking'
];

const ARTIST_HINTS = [
  'dj',
  'producer',
  'artist',
  'live set',
  'music',
  'selector'
];

const normalizeToken = (value) => (value ?? '').toString().toLowerCase().trim();

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
      console.warn(`[youtube-client] retrying ${label} in ${waitMs}ms (attempt ${attempt + 1}/${RETRY_ATTEMPTS})`);
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
        console.warn(`[youtube-client] serving stale cache for ${key} due to upstream error`);
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

const classifyChannelType = (title, description) => {
  const text = `${normalizeToken(title)} ${normalizeToken(description)}`.trim();
  if (!text) return 'artist';
  const hasOrgKeyword = ORG_KEYWORDS.some((keyword) => text.includes(keyword));
  const hasArtistHint = ARTIST_HINTS.some((keyword) => text.includes(keyword));
  if (hasOrgKeyword && !hasArtistHint) return 'organization';
  return 'artist';
};

const extractGenreTokens = (value) => {
  if (!value) return [];
  const normalized = normalizeToken(value);
  if (!normalized) return [];
  const chunks = normalized
    .replace(/[|/#]/g, ',')
    .split(/[,.\n;]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 3 && part.length <= 40);
  return Array.from(new Set(chunks)).slice(0, 8);
};

const getLatestVideoByChannel = async (apiKey, channelIds = []) => {
  const validIds = Array.from(new Set((channelIds || []).filter(Boolean)));
  const out = new Map();

  await Promise.all(validIds.map(async (channelId) => {
    try {
      const response = await requestWithRetry(
        () => http.get(`${YOUTUBE_API_BASE}/search`, {
          params: {
            key: apiKey,
            part: 'snippet',
            channelId,
            type: 'video',
            order: 'date',
            maxResults: 1
          }
        }),
        `latest-video:${channelId}`
      );
      const video = response?.data?.items?.[0];
      const videoId = video?.id?.videoId || null;
      if (!videoId) return;
      out.set(channelId, {
        videoId,
        youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
        publishedAt: video?.snippet?.publishedAt || null
      });
    } catch {
      // Ignore per-channel failure and continue with others.
    }
  }));

  return out;
};

const searchArtistsAndVideos = async (apiKey, query, limit = 20) => {
  if (!apiKey) return [];
  const safeLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 20, 1), 50);
  const normalizedQuery = normalizeToken(query);
  if (!normalizedQuery) return [];
  const cacheKey = `youtube:performers:v1:${normalizedQuery}:${safeLimit}`;

  return withCache(cacheKey, async () => {
    const searchRes = await requestWithRetry(
      () => http.get(`${YOUTUBE_API_BASE}/search`, {
        params: {
          key: apiKey,
          part: 'snippet',
          type: 'channel',
          q: query,
          maxResults: safeLimit
        }
      }),
      `search-channels:${normalizedQuery}`
    );

    const channelIds = Array.from(new Set(
      (searchRes?.data?.items || [])
        .map((item) => item?.snippet?.channelId || item?.id?.channelId || null)
        .filter(Boolean)
    ));
    if (channelIds.length === 0) return [];

    const detailsRes = await requestWithRetry(
      () => http.get(`${YOUTUBE_API_BASE}/channels`, {
        params: {
          key: apiKey,
          part: 'snippet,statistics,brandingSettings',
          id: channelIds.join(','),
          maxResults: Math.min(channelIds.length, 50)
        }
      }),
      `channel-details:${normalizedQuery}`
    );

    const videoByChannel = await getLatestVideoByChannel(apiKey, channelIds);
    const items = Array.isArray(detailsRes?.data?.items) ? detailsRes.data.items : [];
    return items.map((channel) => {
      const id = channel?.id || null;
      const snippet = channel?.snippet || {};
      const title = snippet?.title || null;
      const description = snippet?.description || '';
      const channelType = classifyChannelType(title, description);
      const latest = id ? videoByChannel.get(id) : null;

      return {
        name: title,
        source: 'youtube',
        image: snippet?.thumbnails?.high?.url
          || snippet?.thumbnails?.medium?.url
          || snippet?.thumbnails?.default?.url
          || null,
        genres: extractGenreTokens(description),
        youtubeChannelId: id,
        youtubeChannelUrl: id ? `https://www.youtube.com/channel/${id}` : null,
        youtubeCustomUrl: snippet?.customUrl ? `https://www.youtube.com/${snippet.customUrl}` : null,
        youtubeUrl: latest?.youtubeUrl || null,
        youtubeVideoId: latest?.videoId || null,
        latestYoutubeUrl: latest?.youtubeUrl || null,
        latestYoutubePublishedAt: latest?.publishedAt || null,
        channelType,
        followers: Number.parseInt(channel?.statistics?.subscriberCount, 10) || 0,
        popularity: Number.parseInt(channel?.statistics?.viewCount, 10) || 0
      };
    }).filter((item) => item?.name);
  });
};

module.exports = {
  searchArtistsAndVideos,
  classifyChannelType
};
