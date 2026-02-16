import React, { useState, useEffect } from 'react';

/**
 * MixcloudPlayer - Embeds Mixcloud player using oEmbed API
 * @param {string} mixcloudUrl - Direct Mixcloud URL (e.g., https://www.mixcloud.com/artist/show-name/)
 * @param {string} artistName - Artist name to search for recent mixes (if no URL provided)
 * @param {boolean} autoplay - Enable autoplay (default: false)
 * @param {number} width - Player width (default: 100%)
 * @param {number} height - Player height (default: 120)
 */
const MixcloudPlayer = ({ mixcloudUrl, artistName, autoplay = false, width = '100%', height = 120 }) => {
  const [iframeSrc, setIframeSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMixcloudEmbed = async () => {
      setLoading(true);
      setError(null);

      try {
        let url = mixcloudUrl;

        // If no URL provided but artistName is, try to find recent mixes
        if (!url && artistName) {
          // Search for user/artist on Mixcloud
          const searchResponse = await fetch(
            `https://api.mixcloud.com/search/?q=${encodeURIComponent(artistName)}&type=user&limit=1`
          );

          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            const user = searchData.data?.[0];

            if (user?.key) {
              // Get cloudcasts (mixes) for this user
              const cloudcastsResponse = await fetch(
                `https://api.mixcloud.com${user.key}cloudcasts/?limit=1`
              );

              if (cloudcastsResponse.ok) {
                const cloudcastsData = await cloudcastsResponse.json();
                const latestMix = cloudcastsData.data?.[0];

                if (latestMix?.url) {
                  url = latestMix.url;
                }
              }
            }
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
        widgetUrl.searchParams.set('feed', url);
        widgetUrl.searchParams.set('hide_cover', '1');
        widgetUrl.searchParams.set('light', '1');

        if (autoplay) {
          widgetUrl.searchParams.set('autoplay', '1');
        }

        setIframeSrc(widgetUrl.toString());
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
  }, [mixcloudUrl, artistName, autoplay]);

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
        style={{ display: 'block' }}
      />
    </div>
  );
};

export default MixcloudPlayer;
