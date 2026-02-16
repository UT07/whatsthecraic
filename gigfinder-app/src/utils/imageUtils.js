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

  try {
    // Use Spotify Web API search endpoint
    // Note: This requires a backend proxy or Spotify access token
    // For now, we'll use a fallback approach via our backend
    const response = await fetch(
      `${process.env.REACT_APP_API_BASE || 'https://api.whatsthecraic.run.place'}/performers/search?q=${encodeURIComponent(artistName)}&source=spotify&limit=1`
    );

    if (!response.ok) return null;

    const data = await response.json();
    const imageUrl = data.performers?.[0]?.image || null;

    if (imageUrl) {
      imageCacheStrategy(cacheKey, imageUrl);
    }

    return imageUrl;
  } catch (error) {
    console.warn('Failed to fetch Spotify image for:', artistName, error);
    return null;
  }
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
    }

    return imageUrl;
  } catch (error) {
    console.warn('Failed to fetch Mixcloud image for:', artistName, error);
    return null;
  }
};

/**
 * Fetch best available artist image (tries multiple sources)
 * @param {string} artistName - Name of the artist
 * @returns {Promise<string|null>} Image URL or null
 */
export const fetchArtistImage = async (artistName) => {
  if (!artistName) return null;

  // Try Spotify first (usually better quality)
  let imageUrl = await fetchSpotifyArtistImage(artistName);
  if (imageUrl) return imageUrl;

  // Fallback to Mixcloud
  imageUrl = await fetchMixcloudArtistImage(artistName);
  if (imageUrl) return imageUrl;

  return null;
};
