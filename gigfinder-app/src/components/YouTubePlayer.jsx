import React, { useMemo } from 'react';

const extractVideoId = (value) => {
  if (!value) return null;
  const input = value.toString().trim();
  if (!input) return null;

  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;

  try {
    const parsed = new URL(input);
    if (parsed.hostname.includes('youtu.be')) {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      return id || null;
    }
    if (parsed.hostname.includes('youtube.com')) {
      const watch = parsed.searchParams.get('v');
      if (watch) return watch;
      const parts = parsed.pathname.split('/').filter(Boolean);
      const embedIndex = parts.indexOf('embed');
      if (embedIndex >= 0 && parts[embedIndex + 1]) return parts[embedIndex + 1];
      const shortsIndex = parts.indexOf('shorts');
      if (shortsIndex >= 0 && parts[shortsIndex + 1]) return parts[shortsIndex + 1];
    }
  } catch {
    return null;
  }

  return null;
};

const YouTubePlayer = ({
  youtubeUrl,
  videoId,
  width = '100%',
  height = 150
}) => {
  const resolvedVideoId = useMemo(
    () => videoId || extractVideoId(youtubeUrl),
    [videoId, youtubeUrl]
  );

  if (!resolvedVideoId) return null;

  const src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(resolvedVideoId)}?rel=0&modestbranding=1&playsinline=1`;

  return (
    <div style={{
      width,
      borderRadius: 12,
      overflow: 'hidden',
      border: '1px solid rgba(255,84,84,0.2)',
      background: 'rgba(255,255,255,0.02)'
    }}>
      <iframe
        width="100%"
        height={height}
        src={src}
        title="YouTube Player"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        style={{ display: 'block' }}
      />
    </div>
  );
};

export default YouTubePlayer;
