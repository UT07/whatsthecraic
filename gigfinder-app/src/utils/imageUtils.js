/**
 * Image utility helpers for WhatsTheCraic
 * Picks the best resolution from Ticketmaster image arrays
 */

// Preferred ratios in order of preference for different contexts
const HERO_RATIOS = ['16_9', '3_2', '4_3'];
const CARD_RATIOS = ['3_2', '4_3', '16_9', '1_1'];
const THUMB_RATIOS = ['1_1', '4_3', '3_2'];

/**
 * Pick the best image URL from a Ticketmaster images array.
 * @param {Array} images - Array of {url, ratio, width, height, fallback}
 * @param {'hero'|'card'|'thumb'} context - Display context
 * @param {number} targetWidth - Approximate desired width in px
 * @returns {string|null} Best image URL or null
 */
export const getBestImage = (images, context = 'card', targetWidth = 600) => {
  if (!images || !Array.isArray(images) || images.length === 0) return null;

  // If images are simple {url} objects (Eventbrite, Bandsintown, Dice)
  if (images[0] && !images[0].ratio && images[0].url) {
    return images[0].url;
  }

  const ratioPrefs = context === 'hero' ? HERO_RATIOS
    : context === 'thumb' ? THUMB_RATIOS
    : CARD_RATIOS;

  // Score each image
  const scored = images
    .filter(img => img && img.url && !img.fallback)
    .map(img => {
      const w = parseInt(img.width) || 0;
      const ratioIdx = ratioPrefs.indexOf(img.ratio);
      const ratioScore = ratioIdx >= 0 ? (10 - ratioIdx) : 0;
      // Prefer images close to target width (not too small, not too huge)
      const sizeScore = w > 0 ? Math.max(0, 10 - Math.abs(w - targetWidth) / 100) : 5;
      return { ...img, score: ratioScore * 3 + sizeScore };
    })
    .sort((a, b) => b.score - a.score);

  // Return best scored, or fallback to first available
  return scored[0]?.url || images[0]?.url || null;
};

/**
 * Resolve image URL from a full event object. Falls back across common API shapes.
 * @param {Object} event - Event-like object from search/feed/ml endpoints
 * @param {'hero'|'card'|'thumb'} context
 * @param {number} targetWidth
 * @returns {string|null}
 */
export const resolveEventImage = (event, context = 'card', targetWidth = 600) => {
  if (!event) return null;

  // Preferred path: structured images array.
  if (Array.isArray(event.images) && event.images.length > 0) {
    const best = getBestImage(event.images, context, targetWidth);
    if (best) return best;
  }

  // Some services return images as JSON string.
  if (typeof event.images === 'string' && event.images.trim()) {
    try {
      const parsed = JSON.parse(event.images);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const best = getBestImage(parsed, context, targetWidth);
        if (best) return best;
      }
    } catch {
      // Ignore parse failures and keep fallback chain.
    }
  }

  // Flat image fields used by some endpoints.
  const flatImage = event.image_url || event.imageUrl || event.image || event.poster_url || null;
  if (flatImage) return flatImage;

  return null;
};

/**
 * Get a srcset string for responsive images
 */
export const getImageSrcSet = (images) => {
  if (!images || !Array.isArray(images) || images.length === 0) return '';

  const validImages = images.filter(img => img?.url && img?.width && !img.fallback);
  if (validImages.length === 0) return '';

  return validImages
    .sort((a, b) => (parseInt(a.width) || 0) - (parseInt(b.width) || 0))
    .map(img => `${img.url} ${img.width}w`)
    .join(', ');
};

// Request queue to prevent rate limiting
const requestQueue = {
  queue: [],
  active: 0,
  maxConcurrent: 3,
  delay: 160, // spread API calls to avoid 429 bursts while keeping UI responsive

  add(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.process();
    });
  },

  process() {
    while (this.active < this.maxConcurrent && this.queue.length > 0) {
      const { fn, resolve, reject } = this.queue.shift();
      this.active += 1;
      Promise.resolve()
        .then(fn)
        .then(resolve)
        .catch(reject)
        .finally(() => {
          this.active -= 1;
          setTimeout(() => this.process(), this.delay);
        });
    }
  }
};

const MISS_TTL_MS = 60 * 60 * 1000;
const missCache = new Map();
const pendingArtistImageRequests = new Map();

const isMissCached = (key) => {
  const expiresAt = missCache.get(key);
  if (!expiresAt) return false;
  if (expiresAt <= Date.now()) {
    missCache.delete(key);
    return false;
  }
  return true;
};

const cacheMiss = (key) => {
  missCache.set(key, Date.now() + MISS_TTL_MS);
};

/**
 * Image cache strategy - sessionStorage with 24hr TTL
 * @param {string} key - Cache key
 * @param {string|null} value - Value to store (null to get)
 * @returns {string|null} Cached value or null
 */
export const imageCacheStrategy = (key, value = null) => {
  const TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  if (value !== null) {
    // Store with timestamp
    const cacheItem = {
      url: value,
      timestamp: Date.now()
    };
    try {
      sessionStorage.setItem(key, JSON.stringify(cacheItem));
    } catch (e) {
      // Silent fail if storage is full
      console.warn('SessionStorage full, unable to cache image:', key);
    }
    return value;
  } else {
    // Retrieve and check TTL
    try {
      const cached = sessionStorage.getItem(key);
      if (!cached) return null;

      const cacheItem = JSON.parse(cached);
      const age = Date.now() - cacheItem.timestamp;

      if (age > TTL) {
        // Expired, remove it
        sessionStorage.removeItem(key);
        return null;
      }

      return cacheItem.url;
    } catch (e) {
      return null;
    }
  }
};

/**
 * Fetch artist image from Spotify API
 * @param {string} artistName - Name of the artist
 * @returns {Promise<string|null>} Image URL or null
 */
export const fetchSpotifyArtistImage = async (artistName) => {
  if (!artistName || typeof artistName !== 'string') return null;

  const cacheKey = `img_spotify_${artistName.toLowerCase().trim()}`;
  const cached = imageCacheStrategy(cacheKey);
  if (cached) return cached;
  if (isMissCached(cacheKey)) return null;

  // Add to queue to prevent rate limiting
  return requestQueue.add(async () => {
    try {
      // Use backend /v1/performers endpoint with Spotify filter
      const response = await fetch(
        `${process.env.REACT_APP_API_BASE || 'https://api.whatsthecraic.run.place'}/v1/performers?q=${encodeURIComponent(artistName)}&include=spotify&limit=1`
      );

      if (!response.ok) {
        if (response.status === 429) {
          console.warn('Rate limited on Spotify search for:', artistName);
        }
        return null;
      }

      const data = await response.json();
      const imageUrl = data.performers?.[0]?.image || null;

      if (imageUrl) {
        imageCacheStrategy(cacheKey, imageUrl);
        return imageUrl;
      }

      cacheMiss(cacheKey);
      return null;
    } catch (error) {
      console.warn('Failed to fetch Spotify image for:', artistName, error);
      cacheMiss(cacheKey);
      return null;
    }
  });
};

const tokenizeArtistName = (value) => (value || '')
  .toString()
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .split(/\s+/)
  .map((token) => token.trim())
  .filter((token) => token.length >= 2);

const scoreArtistNameMatch = (targetName, candidateName) => {
  const target = (targetName || '').toString().toLowerCase().trim();
  const candidate = (candidateName || '').toString().toLowerCase().trim();
  if (!target || !candidate) return 0;
  if (candidate === target) return 100;
  if (candidate.startsWith(target) || target.startsWith(candidate)) return 80;

  const targetTokens = tokenizeArtistName(target);
  const candidateTokens = tokenizeArtistName(candidate);
  if (targetTokens.length === 0 || candidateTokens.length === 0) return 0;

  const overlap = targetTokens.filter((token) => candidateTokens.includes(token)).length;
  if (overlap === 0) return 0;

  return Math.round((overlap / targetTokens.length) * 60);
};

const isLikelyPlaceholderImage = (url) => {
  const token = (url || '').toString().toLowerCase();
  if (!token) return true;
  return token.includes('default_avatar') || token.includes('default_user');
};

const normalizeSoundcloudProfileUrl = (value) => {
  const raw = (value || '').toString().trim();
  if (!raw) return null;
  if (!raw.includes('soundcloud.com/')) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, '')}`;
  try {
    const parsed = new URL(withScheme);
    if (!parsed.hostname.toLowerCase().includes('soundcloud.com')) return null;
    const username = parsed.pathname.split('/').filter(Boolean)[0];
    if (!username) return null;
    return `https://soundcloud.com/${username}`;
  } catch {
    return null;
  }
};

const toBestSoundcloudAvatar = (url) => {
  if (!url) return null;
  const value = url.toString();
  return value.includes('-large.')
    ? value.replace('-large.', '-t300x300.')
    : value;
};

/**
 * Fetch artist/profile image directly from a SoundCloud profile URL.
 * Uses SoundCloud oEmbed so we can resolve profile thumbnails from local DB URLs.
 */
export const fetchSoundCloudImageFromUrl = async (soundcloudUrl) => {
  const profileUrl = normalizeSoundcloudProfileUrl(soundcloudUrl);
  if (!profileUrl) return null;
  const [, username = ''] = profileUrl.split('soundcloud.com/');
  const usernameQuery = username.trim();

  const cacheKey = `img_soundcloud_url_${profileUrl.toLowerCase()}`;
  const cached = imageCacheStrategy(cacheKey);
  if (cached) return cached;
  if (isMissCached(cacheKey)) return null;

  return requestQueue.add(async () => {
    try {
      const apiBase = process.env.REACT_APP_API_BASE || 'https://api.whatsthecraic.run.place';
      if (usernameQuery) {
        const searchResponse = await fetch(
          `${apiBase}/v1/performers?q=${encodeURIComponent(usernameQuery)}&include=soundcloud&limit=8`
        );
        if (searchResponse.ok) {
          const data = await searchResponse.json();
          const performers = Array.isArray(data?.performers) ? data.performers : [];
          const normalizedProfile = profileUrl.toLowerCase();
          const best = performers.find((performer) => {
            const candidate = (performer?.soundcloud || performer?.soundcloudUrl || performer?.url || '').toLowerCase();
            return candidate && (candidate.includes(normalizedProfile) || normalizedProfile.includes(candidate));
          }) || performers
            .map((performer) => ({
              performer,
              score: scoreArtistNameMatch(usernameQuery, performer?.username || performer?.name),
              hasImage: performer?.image && !isLikelyPlaceholderImage(performer.image)
            }))
            .filter((row) => row.hasImage)
            .sort((a, b) => b.score - a.score)[0]?.performer;

          const imageUrl = toBestSoundcloudAvatar(best?.image || null);
          if (imageUrl && !isLikelyPlaceholderImage(imageUrl)) {
            imageCacheStrategy(cacheKey, imageUrl);
            return imageUrl;
          }
        }
      }

      const response = await fetch(
        `https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(profileUrl)}`
      );
      if (!response.ok) return null;

      const data = await response.json();
      const imageUrl = toBestSoundcloudAvatar(data?.thumbnail_url || null);
      if (imageUrl && !isLikelyPlaceholderImage(imageUrl)) {
        imageCacheStrategy(cacheKey, imageUrl);
        return imageUrl;
      }

      cacheMiss(cacheKey);
      return null;
    } catch (error) {
      console.warn('Failed to fetch SoundCloud profile image for URL:', profileUrl, error);
      cacheMiss(cacheKey);
      return null;
    }
  });
};

/**
 * Fetch artist image from SoundCloud via backend /v1/performers
 * @param {string} artistName - Name of the artist
 * @returns {Promise<string|null>} Image URL or null
 */
export const fetchSoundCloudArtistImage = async (artistName) => {
  if (!artistName || typeof artistName !== 'string') return null;

  const cacheKey = `img_soundcloud_${artistName.toLowerCase().trim()}`;
  const cached = imageCacheStrategy(cacheKey);
  if (cached) return cached;
  if (isMissCached(cacheKey)) return null;

  return requestQueue.add(async () => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_API_BASE || 'https://api.whatsthecraic.run.place'}/v1/performers?q=${encodeURIComponent(artistName)}&include=soundcloud&limit=3`
      );

      if (!response.ok) return null;

      const data = await response.json();
      const performers = Array.isArray(data.performers) ? data.performers : [];
      const best = performers
        .map((performer) => ({
          performer,
          score: scoreArtistNameMatch(artistName, performer?.name),
          hasImage: performer?.image && !isLikelyPlaceholderImage(performer.image)
        }))
        .filter((row) => row.hasImage)
        .sort((a, b) => b.score - a.score)[0];
      const imageUrl = best?.score >= 20 ? best.performer?.image : null;

      if (imageUrl) {
        imageCacheStrategy(cacheKey, imageUrl);
        return imageUrl;
      }

      cacheMiss(cacheKey);
      return null;
    } catch (error) {
      console.warn('Failed to fetch SoundCloud image for:', artistName, error);
      cacheMiss(cacheKey);
      return null;
    }
  });
};

/**
 * Fetch artist image from Mixcloud API
 * @param {string} artistName - Name of the artist
 * @returns {Promise<string|null>} Image URL or null
 */
export const fetchMixcloudArtistImage = async (artistName) => {
  if (!artistName || typeof artistName !== 'string') return null;

  const cacheKey = `img_mixcloud_${artistName.toLowerCase().trim()}`;
  const cached = imageCacheStrategy(cacheKey);
  if (cached) return cached;
  if (isMissCached(cacheKey)) return null;

  try {
    // Use Mixcloud API search
    // Mixcloud API: https://api.mixcloud.com/search/?q=<query>&type=cloudcast
    const response = await fetch(
      `https://api.mixcloud.com/search/?q=${encodeURIComponent(artistName)}&type=user&limit=1`
    );

    if (!response.ok) return null;

    const data = await response.json();
    const imageUrl = data.data?.[0]?.pictures?.large || data.data?.[0]?.pictures?.medium || null;

    if (imageUrl) {
      imageCacheStrategy(cacheKey, imageUrl);
      return imageUrl;
    }

    cacheMiss(cacheKey);
    return null;
  } catch (error) {
    console.warn('Failed to fetch Mixcloud image for:', artistName, error);
    cacheMiss(cacheKey);
    return null;
  }
};

/**
 * Fetch best available artist image (tries multiple sources)
 * @param {string} artistName - Name of the artist
 * @param {object} options
 * @param {string|null} options.soundcloudUrl - Optional direct SoundCloud URL from local DB
 * @returns {Promise<string|null>} Image URL or null
 */
export const fetchArtistImage = async (artistName, options = {}) => {
  if (!artistName) return null;
  const normalizedName = artistName.toLowerCase().trim();
  const normalizedSoundcloudUrl = normalizeSoundcloudProfileUrl(options?.soundcloudUrl || null);
  if (!normalizedName) return null;

  const requestKey = `${normalizedName}|${normalizedSoundcloudUrl || ''}`;

  if (pendingArtistImageRequests.has(requestKey)) {
    return pendingArtistImageRequests.get(requestKey);
  }

  const task = (async () => {
    // Prefer explicit SoundCloud profile URL (local DB source of truth).
    if (normalizedSoundcloudUrl) {
      const directImage = await fetchSoundCloudImageFromUrl(normalizedSoundcloudUrl);
      if (directImage) return directImage;
    }

    // Prefer SoundCloud first for broader artist coverage.
    let imageUrl = await fetchSoundCloudArtistImage(artistName);
    if (imageUrl) return imageUrl;

    // Then Spotify (quality fallback).
    imageUrl = await fetchSpotifyArtistImage(artistName);
    if (imageUrl) return imageUrl;

    // Use Mixcloud.
    imageUrl = await fetchMixcloudArtistImage(artistName);
    if (imageUrl) return imageUrl;

    return null;
  })()
    .finally(() => {
      pendingArtistImageRequests.delete(requestKey);
    });

  pendingArtistImageRequests.set(requestKey, task);
  return task;
};
