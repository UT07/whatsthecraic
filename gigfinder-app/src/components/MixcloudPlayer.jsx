import React, { useState, useEffect } from 'react';

const embedCache = new Map();

const normalizeFeedValue = (url) => {
  if (!url) return null;
  const raw = url.toString().trim();
  if (!raw) return null;

  // Keep relative feed paths as-is (e.g. /user/show/)
  if (raw.startsWith('/')) {
    return raw.endsWith('/') ? raw : `${raw}/`;
  }

  try {
    const parsed = new URL(raw);
    if (!parsed.hostname.includes('mixcloud.com')) return raw;
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length === 0) return null;
    return `/${parts.join('/')}/`;
  } catch {
    return raw;
  }
};

const isProfileFeed = (feedValue) => {
  const normalized = normalizeFeedValue(feedValue);
  if (!normalized) return false;
  const parts = normalized.split('/').filter(Boolean);
  return parts.length <= 1;
};

const resolveLatestCloudcastUrl = async (artistName) => {
  if (!artistName) return null;

  const searchResponse = await fetch(
    `https://api.mixcloud.com/search/?q=${encodeURIComponent(artistName)}&type=user&limit=1`
  );
  if (!searchResponse.ok) return null;

  const searchData = await searchResponse.json();
  const user = searchData?.data?.[0];
  if (!user?.key) return null;

  const cloudcastsResponse = await fetch(
    `https://api.mixcloud.com${user.key}cloudcasts/?limit=1`
  );
  if (!cloudcastsResponse.ok) return null;

  const cloudcastsData = await cloudcastsResponse.json();
  return cloudcastsData?.data?.[0]?.url || null;
};

/**
 * MixcloudPlayer - Embeds Mixcloud player using oEmbed API
 * @param {string} mixcloudUrl - Direct Mixcloud URL (e.g., https://www.mixcloud.com/artist/show-name/)
 * @param {string} artistName - Artist name to search for recent mixes (if no URL provided)
 * @param {boolean} autoplay - Enable autoplay (default: false)
 * @param {boolean} allowLookup - Allow client-side Mixcloud API lookups (default: false)
 * @param {number} width - Player width (default: 100%)
 * @param {number} height - Player height (default: 120)
 */
const MixcloudPlayer = ({
  mixcloudUrl,
  artistName,
  autoplay = false,
  allowLookup = false,
  width = '100%',
  height = 150
}) => {
  const [iframeSrc, setIframeSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMixcloudEmbed = async () => {
      setLoading(true);
      setError(null);

      try {
        const cacheKey = `${mixcloudUrl || ''}|${artistName || ''}|${autoplay ? '1' : '0'}|${allowLookup ? '1' : '0'}`;
        const cached = embedCache.get(cacheKey);
        if (cached) {
          setIframeSrc(cached);
          setLoading(false);
          return;
        }

        let url = mixcloudUrl;

        // If URL is absent or points to profile only, resolve to latest cloudcast.
        if ((!url || isProfileFeed(url)) && artistName && allowLookup) {
          const latest = await resolveLatestCloudcastUrl(artistName).catch(() => null);
          if (latest) {
            url = latest;
          }
        }

        if (!url) {
          setError('No Mixcloud URL or artist found');
          setLoading(false);
          return;
        }

        // Build Mixcloud widget URL directly (safer than parsing HTML)
        // Format: https://www.mixcloud.com/widget/iframe/?feed=<encoded_url>
        const widgetUrl = new URL('https://www.mixcloud.com/widget/iframe/');
        widgetUrl.searchParams.set('feed', normalizeFeedValue(url) || url);
        widgetUrl.searchParams.set('hide_cover', '0');
        widgetUrl.searchParams.set('light', '0');

        if (autoplay) {
          widgetUrl.searchParams.set('autoplay', '1');
        }

        const resolvedIframe = widgetUrl.toString();
        embedCache.set(cacheKey, resolvedIframe);
        setIframeSrc(resolvedIframe);
      } catch (err) {
        console.error('Mixcloud embed error:', err);
        setError(err.message || 'Failed to load Mixcloud player');
      } finally {
        setLoading(false);
      }
    };

    if (mixcloudUrl || artistName) {
      fetchMixcloudEmbed();
    } else {
      setLoading(false);
      setError('No Mixcloud URL or artist name provided');
    }
  }, [mixcloudUrl, artistName, autoplay, allowLookup]);

  if (loading) {
    return (
      <div style={{
        width,
        height,
        borderRadius: 12,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(82,177,252,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--muted)'
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
          <circle cx="12" cy="12" r="10" opacity="0.25" />
          <path d="M12 2 A10 10 0 0 1 22 12" opacity="1" />
        </svg>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error || !iframeSrc) {
    return null; // Silently fail - don't show error UI
  }

  return (
    <div style={{
      width,
      borderRadius: 12,
      overflow: 'hidden',
      border: '1px solid rgba(82,177,252,0.15)'
    }}>
      <iframe
        width="100%"
        height={height}
        src={iframeSrc}
        frameBorder="0"
        title="Mixcloud Player"
        allow="autoplay"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        style={{ display: 'block' }}
      />
    </div>
  );
};

export default MixcloudPlayer;
