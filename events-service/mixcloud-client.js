const axios = require('axios');

const MIXCLOUD_API = 'https://api.mixcloud.com';
const http = axios.create({ timeout: 10000 });
const cache = new Map();
const CACHE_TTL_MS = Number.parseInt(process.env.MIXCLOUD_CACHE_TTL_MS || `${15 * 60 * 1000}`, 10);

const withCache = async (key, fn) => {
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
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

/**
 * Search for DJs/users on Mixcloud
 * @returns {Array} [{name, username, url, image, key}]
 */
const searchDJs = async (query, limit = 20) => {
  const safeLimit = Math.min(limit, 50);
  return withCache(`mixcloud:searchDJs:${(query || '').toLowerCase().trim()}:${safeLimit}`, async () => {
    const response = await http.get(`${MIXCLOUD_API}/search/`, {
      params: { q: query, type: 'user', limit: safeLimit }
    });
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
    const response = await http.get(`${MIXCLOUD_API}/search/`, {
      params: { q: query, type: 'cloudcast', limit: safeLimit }
    });
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
    const response = await http.get(`${MIXCLOUD_API}/${encodeURIComponent(username)}/`);
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
    const response = await http.get(`${MIXCLOUD_API}/${encodeURIComponent(username)}/cloudcasts/`, {
      params: { limit: safeLimit }
    });
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
