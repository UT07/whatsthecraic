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
