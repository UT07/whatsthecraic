const normalizeToken = (value) => (value || '')
  .toString()
  .toLowerCase()
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const parseGenres = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    const trimmed = value.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
      } catch {
        // Fall through to comma split.
      }
    }
    return trimmed
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const parseDateValue = (event) => (
  event?.start_time
  || event?.start_date
  || event?.datetime
  || event?.date
  || null
);

const toIsoDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const cleanEventTitle = (title) => {
  const raw = (title || '').toString().trim();
  if (!raw) return '';
  return raw
    .replace(/\s*-\s*(premium priced seats?|vip packages?|platinum tickets?|accessible tickets?).*$/i, '')
    .replace(/\s*\((rescheduled|new date|extra date)\)\s*$/i, '')
    .trim();
};

const dedupePrimitiveList = (items) => {
  const seen = new Set();
  const out = [];
  (Array.isArray(items) ? items : []).forEach((item) => {
    const normalized = normalizeToken(item);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    out.push(item);
  });
  return out;
};

const dedupeSources = (sources) => {
  const seen = new Set();
  const out = [];
  (Array.isArray(sources) ? sources : []).forEach((source) => {
    if (!source) return;
    const key = typeof source === 'string'
      ? normalizeToken(source)
      : normalizeToken(source.source);
    if (!key || seen.has(key)) return;
    seen.add(key);
    out.push(source);
  });
  return out;
};

const buildSession = (event) => {
  const start = toIsoDate(parseDateValue(event));
  const end = toIsoDate(event?.end_time || null);
  return {
    id: event?.id || event?.event_id || null,
    start_time: start,
    end_time: end,
    ticket_url: event?.ticket_url || null
  };
};

const sessionKey = (session) => [
  session.start_time || '',
  session.end_time || '',
  normalizeToken(session.ticket_url || '')
].join('|');

const inferImageArray = (event) => {
  if (!event) return [];
  if (Array.isArray(event.images) && event.images.length > 0) {
    return event.images
      .map((image) => {
        if (!image) return null;
        if (typeof image === 'string') return { url: image };
        if (typeof image === 'object' && image.url) return image;
        if (typeof image === 'object' && image.src) return { ...image, url: image.src };
        if (typeof image === 'object' && image.image_url) return { ...image, url: image.image_url };
        return null;
      })
      .filter(Boolean);
  }
  if (typeof event.images === 'string' && event.images.trim()) {
    try {
      const parsed = JSON.parse(event.images);
      if (Array.isArray(parsed)) {
        return parsed
          .map((image) => {
            if (!image) return null;
            if (typeof image === 'string') return { url: image };
            if (typeof image === 'object' && image.url) return image;
            if (typeof image === 'object' && image.src) return { ...image, url: image.src };
            if (typeof image === 'object' && image.image_url) return { ...image, url: image.image_url };
            return null;
          })
          .filter(Boolean);
      }
    } catch {
      // Ignore parse failures.
    }
  }
  const url = event.image_url || event.imageUrl || event.image || event.poster_url || null;
  return url ? [{ url }] : [];
};

const buildSeriesKey = (event) => {
  const title = cleanEventTitle(event?.title || event?.event_name || '');
  const venue = event?.venue_name || event?.venue || '';
  const city = event?.city || '';
  const key = [
    normalizeToken(title),
    normalizeToken(venue),
    normalizeToken(city)
  ].join('::');
  return key || `event::${event?.id || event?.event_id || normalizeToken(title)}`;
};

const sortByStartTime = (items) => [...items].sort((a, b) => {
  const aTime = new Date(a.start_time || 0).getTime();
  const bTime = new Date(b.start_time || 0).getTime();
  return aTime - bTime;
});

export const normalizeRecommendationEvent = (event, fallbackById = new Map()) => {
  const eventId = event?.event_id || event?.id;
  const fallback = eventId ? fallbackById.get(String(eventId)) : null;
  const start = toIsoDate(parseDateValue(event)) || fallback?.start_time || null;
  const end = toIsoDate(event?.end_time) || fallback?.end_time || null;
  const eventImages = inferImageArray(event);
  const fallbackImages = inferImageArray(fallback);
  const genres = dedupePrimitiveList([
    ...parseGenres(event?.genres),
    ...parseGenres(event?.genre),
    ...parseGenres(fallback?.genres)
  ]);
  return {
    ...(fallback || {}),
    ...event,
    id: eventId || fallback?.id || null,
    title: event?.title || event?.event_name || fallback?.title || 'Untitled event',
    start_time: start,
    end_time: end,
    venue_name: event?.venue_name || fallback?.venue_name || 'Venue TBA',
    city: event?.city || fallback?.city || null,
    ticket_url: event?.ticket_url || fallback?.ticket_url || null,
    images: eventImages.length > 0 ? eventImages : fallbackImages,
    genres,
    rank_score: event?.rank_score ?? event?.score ?? fallback?.rank_score ?? 0,
    rank_reasons: event?.rank_reasons || fallback?.rank_reasons || [],
    sources: dedupeSources([...(fallback?.sources || []), ...(event?.sources || [])]),
    source: event?.source || fallback?.source || event?.algorithm || null
  };
};

export const groupEventsForDisplay = (events) => {
  const grouped = new Map();

  (Array.isArray(events) ? events : []).forEach((rawEvent) => {
    if (!rawEvent) return;
    const event = {
      ...rawEvent,
      title: cleanEventTitle(rawEvent.title || rawEvent.event_name || ''),
      start_time: toIsoDate(parseDateValue(rawEvent)),
      end_time: toIsoDate(rawEvent.end_time),
      images: inferImageArray(rawEvent),
      genres: dedupePrimitiveList([...parseGenres(rawEvent.genres), ...parseGenres(rawEvent.genre)]),
      sources: rawEvent.sources || (rawEvent.source ? [{ source: rawEvent.source, source_id: rawEvent.source_id || rawEvent.id }] : [])
    };

    if (!event.title) return;
    const key = buildSeriesKey(event);
    const session = buildSession(event);

    if (!grouped.has(key)) {
      grouped.set(key, {
        ...event,
        group_id: key,
        sessions: session.start_time ? [session] : [],
        sources: dedupeSources(event.sources),
        genres: dedupePrimitiveList(event.genres),
        tags: dedupePrimitiveList(event.tags || []),
        rank_reasons: dedupePrimitiveList(event.rank_reasons || [])
      });
      return;
    }

    const existing = grouped.get(key);
    const existingSessions = Array.isArray(existing.sessions) ? existing.sessions : [];
    if (session.start_time && !existingSessions.some((item) => sessionKey(item) === sessionKey(session))) {
      existingSessions.push(session);
    }
    existing.sessions = existingSessions;

    const existingScore = Number(existing.rank_score || 0);
    const incomingScore = Number(event.rank_score || 0);
    if (incomingScore > existingScore) {
      existing.rank_score = event.rank_score;
      existing.rank_reasons = dedupePrimitiveList([...(existing.rank_reasons || []), ...(event.rank_reasons || [])]);
      if (Array.isArray(event.images) && event.images.length > 0) {
        existing.images = event.images;
      }
    } else if ((!existing.images || existing.images.length === 0) && Array.isArray(event.images) && event.images.length > 0) {
      existing.images = event.images;
    }

    existing.sources = dedupeSources([...(existing.sources || []), ...(event.sources || [])]);
    existing.genres = dedupePrimitiveList([...(existing.genres || []), ...(event.genres || [])]);
    existing.tags = dedupePrimitiveList([...(existing.tags || []), ...(event.tags || [])]);

    grouped.set(key, existing);
  });

  return sortByStartTime(
    Array.from(grouped.values()).map((event) => {
      const sessions = sortByStartTime((event.sessions || []).filter((session) => session.start_time));
      return {
        ...event,
        sessions,
        session_count: sessions.length || 1,
        start_time: sessions[0]?.start_time || event.start_time || null,
        end_time: sessions[0]?.end_time || event.end_time || null
      };
    })
  );
};
