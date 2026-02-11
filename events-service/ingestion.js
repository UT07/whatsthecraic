const axios = require('axios');
const crypto = require('crypto');

const http = axios.create({ timeout: 10000 });

const toMysqlDateTime = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace('T', ' ');
};

const toEventbriteDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const normalizeTitle = (value) => {
  return (value || '')
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
};

const geoBucket = (lat, lon) => {
  if (lat == null || lon == null) return 'na';
  const latBucket = Math.round(parseFloat(lat) * 100) / 100;
  const lonBucket = Math.round(parseFloat(lon) * 100) / 100;
  if (Number.isNaN(latBucket) || Number.isNaN(lonBucket)) return 'na';
  return `${latBucket},${lonBucket}`;
};

const timeBucket = (value) => {
  if (!value) return 'na';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'na';
  date.setMinutes(0, 0, 0);
  return date.toISOString();
};

const toTicketmasterDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
};

const safeJsonParse = (value) => {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (err) {
    return null;
  }
};

const buildDedupeKey = ({ title, start_time, latitude, longitude }) => {
  const base = `${normalizeTitle(title)}|${geoBucket(latitude, longitude)}|${timeBucket(start_time)}`;
  return crypto.createHash('sha1').update(base).digest('hex');
};

const upsertEvent = async (pool, event) => {
  const dedupeKey = buildDedupeKey(event);
  const result = await pool.execute(
    `INSERT INTO events
      (dedupe_key, title, description, start_time, end_time, city, latitude, longitude, venue_name, ticket_url, age_restriction,
       price_min, price_max, currency, genres, tags, images)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       title = VALUES(title),
       description = VALUES(description),
       start_time = VALUES(start_time),
       end_time = VALUES(end_time),
       city = VALUES(city),
       latitude = VALUES(latitude),
       longitude = VALUES(longitude),
       venue_name = VALUES(venue_name),
       ticket_url = VALUES(ticket_url),
       age_restriction = VALUES(age_restriction),
       price_min = VALUES(price_min),
       price_max = VALUES(price_max),
       currency = VALUES(currency),
       genres = VALUES(genres),
       tags = VALUES(tags),
       images = VALUES(images),
       updated_at = CURRENT_TIMESTAMP,
       id = LAST_INSERT_ID(id)`,
    [
      dedupeKey,
      event.title,
      event.description || null,
      event.start_time,
      event.end_time || null,
      event.city || null,
      event.latitude || null,
      event.longitude || null,
      event.venue_name || null,
      event.ticket_url || null,
      event.age_restriction || null,
      event.price_min ?? null,
      event.price_max ?? null,
      event.currency || null,
      JSON.stringify(event.genres || []),
      JSON.stringify(event.tags || []),
      JSON.stringify(event.images || [])
    ]
  );

  const [meta] = result;
  return meta.insertId;
};

const upsertSourceEvent = async (pool, sourceEvent) => {
  await pool.execute(
    `INSERT INTO source_events
      (source, source_id, event_id, raw_payload, last_seen_at)
     VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE
       event_id = VALUES(event_id),
       raw_payload = VALUES(raw_payload),
       last_seen_at = CURRENT_TIMESTAMP`,
    [
      sourceEvent.source,
      sourceEvent.source_id,
      sourceEvent.event_id,
      JSON.stringify(sourceEvent.raw_payload || {})
    ]
  );
};

const updateIngestState = async (pool, source, city, windowStart, windowEnd) => {
  await pool.execute(
    `INSERT INTO ingest_state (source, city, last_synced_at, window_start, window_end)
     VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)
     ON DUPLICATE KEY UPDATE
       last_synced_at = CURRENT_TIMESTAMP,
       window_start = VALUES(window_start),
       window_end = VALUES(window_end)`,
    [source, city, windowStart, windowEnd]
  );
};

const fetchEventbriteOrganizations = async (token) => {
  const response = await http.get('https://www.eventbriteapi.com/v3/users/me/organizations/', {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data?.organizations || [];
};

const ingestEventbriteOrganizationEvents = async (pool, { city, startDate, endDate, token, maxPages = 5, orgIds }) => {
  const startDateTime = toEventbriteDate(startDate);
  const endDateTime = toEventbriteDate(endDate);
  const organizations = (orgIds && orgIds.length)
    ? orgIds.map(id => ({ id }))
    : await fetchEventbriteOrganizations(token);

  let ingested = 0;

  for (const org of organizations) {
    const orgId = org.id;
    if (!orgId) continue;

    let page = 1;
    let hasMore = true;

    while (hasMore && page <= maxPages) {
      const response = await http.get(`https://www.eventbriteapi.com/v3/organizations/${orgId}/events/`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          'start_date.range_start': startDateTime,
          'start_date.range_end': endDateTime,
          expand: 'venue',
          page
        }
      });

      const data = response.data || {};
      const events = data.events || [];
      hasMore = data.pagination?.has_more_items || false;

      for (const evt of events) {
        const venue = evt.venue || {};
        const address = venue.address || {};

        const eventRecord = {
          title: evt.name?.text || evt.name,
          description: evt.description?.text || null,
          start_time: toMysqlDateTime(evt.start?.utc || evt.start?.local),
          end_time: toMysqlDateTime(evt.end?.utc || evt.end?.local),
          city: address.city || city,
          latitude: venue.latitude || null,
          longitude: venue.longitude || null,
          venue_name: venue.name || null,
          ticket_url: evt.url || null,
          age_restriction: evt.age_restriction || null,
          price_min: null,
          price_max: null,
          currency: null,
          genres: [],
          tags: ['eventbrite'],
          images: evt.logo ? [evt.logo] : []
        };

        if (!eventRecord.title || !eventRecord.start_time) {
          continue;
        }

        const eventId = await upsertEvent(pool, eventRecord);
        await upsertSourceEvent(pool, {
          source: 'eventbrite',
          source_id: evt.id,
          event_id: eventId,
          raw_payload: evt
        });
        ingested += 1;
      }

      page += 1;
    }
  }

  await updateIngestState(pool, 'eventbrite', city, startDate, endDate);
  return { source: 'eventbrite', skipped: false, count: ingested };
};

const ingestTicketmaster = async (pool, { city, startDate, endDate, apiKey, countryCode, maxPages = 5 }) => {
  if (!apiKey) {
    return { source: 'ticketmaster', skipped: true, reason: 'missing_api_key', count: 0 };
  }

  let page = 0;
  let ingested = 0;
  let totalPages = 1;

  const startDateTime = toTicketmasterDate(startDate);
  const endDateTime = toTicketmasterDate(endDate);

  while (page < totalPages && page < maxPages) {
    const url = 'https://app.ticketmaster.com/discovery/v2/events.json';
    const response = await http.get(url, {
      params: {
        apikey: apiKey,
        city,
        ...(countryCode ? { countryCode } : {}),
        startDateTime,
        endDateTime,
        size: 100,
        page
      }
    });

    const data = response.data || {};
    totalPages = data.page?.totalPages ?? 0;
    const events = data._embedded?.events || [];

    for (const evt of events) {
      const venue = evt._embedded?.venues?.[0] || {};
      const start = evt.dates?.start?.dateTime || (evt.dates?.start?.localDate && evt.dates?.start?.localTime
        ? `${evt.dates.start.localDate}T${evt.dates.start.localTime}`
        : evt.dates?.start?.localDate);

      const end = evt.dates?.end?.dateTime || null;

      const price = evt.priceRanges?.[0] || {};
      const genres = (evt.classifications || [])
        .map(c => c.genre?.name)
        .filter(Boolean)
        .map(value => value.toLowerCase());

      const eventRecord = {
        title: evt.name,
        description: evt.info || evt.pleaseNote || null,
        start_time: toMysqlDateTime(start),
        end_time: toMysqlDateTime(end),
        city: venue.city?.name || city,
        latitude: venue.location?.latitude || null,
        longitude: venue.location?.longitude || null,
        venue_name: venue.name || null,
        ticket_url: evt.url || null,
        age_restriction: evt.ageRestrictions?.legalAgeEnforced ? '18+' : null,
        price_min: price.min ?? null,
        price_max: price.max ?? null,
        currency: price.currency || null,
        genres,
        tags: ['ticketmaster'],
        images: evt.images || []
      };

      if (!eventRecord.title || !eventRecord.start_time) {
        continue;
      }

      const eventId = await upsertEvent(pool, eventRecord);
      await upsertSourceEvent(pool, {
        source: 'ticketmaster',
        source_id: evt.id,
        event_id: eventId,
        raw_payload: evt
      });
      ingested += 1;
    }

    page += 1;
  }

  await updateIngestState(pool, 'ticketmaster', city, startDate, endDate);
  return { source: 'ticketmaster', skipped: false, count: ingested };
};

const ingestEventbrite = async (pool, { city, startDate, endDate, token, maxPages = 5, orgIds }) => {
  if (!token) {
    return { source: 'eventbrite', skipped: true, reason: 'missing_api_token', count: 0 };
  }

  let page = 1;
  let ingested = 0;
  let hasMore = true;

  const startDateTime = toEventbriteDate(startDate);
  const endDateTime = toEventbriteDate(endDate);

  while (hasMore && page <= maxPages) {
    let response;
    try {
      response = await http.get('https://www.eventbriteapi.com/v3/events/search/', {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          'location.address': city,
          'start_date.range_start': startDateTime,
          'start_date.range_end': endDateTime,
          expand: 'venue',
          page
        }
      });
    } catch (err) {
      const status = err.response?.status;
      if (status === 404) {
        return await ingestEventbriteOrganizationEvents(pool, { city, startDate, endDate, token, maxPages, orgIds });
      }
      if (status) {
        return { source: 'eventbrite', skipped: true, reason: `http_${status}`, count: ingested };
      }
      throw err;
    }

    const data = response.data || {};
    const events = data.events || [];
    hasMore = data.pagination?.has_more_items || false;

    for (const evt of events) {
      const venue = evt.venue || {};
      const address = venue.address || {};

      const eventRecord = {
        title: evt.name?.text || evt.name,
        description: evt.description?.text || null,
        start_time: toMysqlDateTime(evt.start?.utc || evt.start?.local),
        end_time: toMysqlDateTime(evt.end?.utc || evt.end?.local),
        city: address.city || city,
        latitude: address.latitude || null,
        longitude: address.longitude || null,
        venue_name: venue.name || null,
        ticket_url: evt.url || null,
        age_restriction: null,
        price_min: evt.is_free ? 0 : null,
        price_max: evt.is_free ? 0 : null,
        currency: evt.currency || null,
        genres: [],
        tags: ['eventbrite'],
        images: evt.logo ? [evt.logo] : []
      };

      if (!eventRecord.title || !eventRecord.start_time) {
        continue;
      }

      const eventId = await upsertEvent(pool, eventRecord);
      await upsertSourceEvent(pool, {
        source: 'eventbrite',
        source_id: evt.id,
        event_id: eventId,
        raw_payload: evt
      });
      ingested += 1;
    }

    page += 1;
  }

  await updateIngestState(pool, 'eventbrite', city, startDate, endDate);
  return { source: 'eventbrite', skipped: false, count: ingested };
};

const normalizeDiceActorId = (value) => {
  if (!value) return 'lexis-solutions~dice-fm';
  return value.replace('/', '~');
};

const normalizeTagList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(item => String(item).toLowerCase().trim()).filter(Boolean);
  }
  return String(value)
    .split(/[,|/]+/)
    .map(item => item.toLowerCase().trim())
    .filter(Boolean);
};

const inferCurrency = (value) => {
  if (typeof value !== 'string') return null;
  if (value.includes('€')) return 'EUR';
  if (value.includes('£')) return 'GBP';
  if (value.includes('$')) return 'USD';
  return null;
};

const parsePrice = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const cleaned = String(value).replace(/[^0-9.]/g, '');
  if (!cleaned) return null;
  const parsed = Number.parseFloat(cleaned);
  return Number.isNaN(parsed) ? null : parsed;
};

const parseDiceDate = (value) => {
  if (!value) return null;
  if (typeof value === 'number') {
    const ms = value < 1e12 ? value * 1000 : value;
    return toMysqlDateTime(ms);
  }
  return toMysqlDateTime(value);
};

const parseBandsintownDate = (value) => {
  if (!value) return null;
  return toMysqlDateTime(value);
};

const normalizeBandsintownTags = (lineup) => {
  if (!Array.isArray(lineup)) return [];
  return lineup
    .map(item => String(item || '').trim().toLowerCase())
    .filter(Boolean);
};

const ingestBandsintownArtists = async (pool, {
  artists = [],
  appId,
  startDate,
  endDate,
  city,
  maxArtists = 10,
  maxEvents = 300
}) => {
  if (!appId) {
    return { source: 'bandsintown', skipped: true, reason: 'missing_app_id', count: 0 };
  }

  if (!artists || artists.length === 0) {
    return { source: 'bandsintown', skipped: true, reason: 'no_artists', count: 0 };
  }

  const fromDate = startDate ? new Date(startDate) : null;
  const toDate = endDate ? new Date(endDate) : null;
  let ingested = 0;

  const trimmedArtists = artists
    .map(name => String(name || '').trim())
    .filter(Boolean)
    .slice(0, maxArtists);

  for (const artist of trimmedArtists) {
    const response = await http.get(
      `https://rest.bandsintown.com/artists/${encodeURIComponent(artist)}/events`,
      { params: { app_id: appId } }
    );
    const events = Array.isArray(response.data) ? response.data : [];

    for (const evt of events) {
      if (ingested >= maxEvents) break;
      const startTime = parseBandsintownDate(
        evt?.datetime || evt?.starts_at || evt?.start_datetime || evt?.date
      );
      if (!startTime) continue;
      const startObj = new Date(startTime);
      if (Number.isNaN(startObj.getTime())) continue;
      if (fromDate && startObj < fromDate) continue;
      if (toDate && startObj > toDate) continue;

      const venue = evt?.venue || {};
      if (city && venue.city && venue.city.toLowerCase() !== city.toLowerCase()) {
        continue;
      }

      const tags = normalizeBandsintownTags(evt?.lineup);
      const ticketUrl = evt?.offers?.[0]?.url || evt?.url || null;

      const eventRecord = {
        title: evt?.title || evt?.name || `${artist} Live`,
        description: evt?.description || null,
        start_time: startTime,
        end_time: parseBandsintownDate(evt?.ends_at) || null,
        city: venue.city || city || null,
        latitude: venue.latitude || null,
        longitude: venue.longitude || null,
        venue_name: venue.name || null,
        ticket_url: ticketUrl,
        age_restriction: evt?.age_restriction || null,
        price_min: null,
        price_max: null,
        currency: null,
        genres: [],
        tags: ['bandsintown', ...tags],
        images: evt?.artist?.image_url ? [{ url: evt.artist.image_url }] : []
      };

      if (!eventRecord.title || !eventRecord.start_time) {
        continue;
      }

      const eventId = await upsertEvent(pool, eventRecord);
      await upsertSourceEvent(pool, {
        source: 'bandsintown',
        source_id: String(evt?.id || evt?.url || `${artist}-${eventId}`),
        event_id: eventId,
        raw_payload: evt
      });
      ingested += 1;
    }
  }

  await updateIngestState(pool, 'bandsintown', city || 'global', startDate, endDate);
  return { source: 'bandsintown', skipped: false, count: ingested };
};

const ingestDiceApify = async (pool, { city, startDate, endDate, enabled = true, actorId, apifyToken, maxItems = 200, useProxy = true }) => {
  if (!enabled) {
    return { source: 'dice', skipped: true, reason: 'disabled', count: 0 };
  }
  if (!apifyToken) {
    return { source: 'dice', skipped: true, reason: 'missing_apify_token', count: 0 };
  }

  const resolvedActor = normalizeDiceActorId(actorId);
  const url = `https://api.apify.com/v2/acts/${encodeURIComponent(resolvedActor)}/run-sync-get-dataset-items`;
  const payload = {
    query: city || 'Dublin',
    type: 'city',
    maxItems,
    dateFrom: startDate ? toEventbriteDate(startDate) : undefined,
    dateUntil: endDate ? toEventbriteDate(endDate) : undefined,
    proxyConfiguration: { useApifyProxy: useProxy }
  };

  const response = await http.post(url, payload, {
    headers: { Authorization: `Bearer ${apifyToken}` },
    timeout: 120000
  });
  const items = Array.isArray(response.data)
    ? response.data
    : response.data?.items || [];

  let ingested = 0;

  for (const item of items) {
    const sourceId = item?.id || item?.eventId || item?.slug || item?.url;
    if (!sourceId) continue;

    const priceMin = parsePrice(item.priceFrom ?? item.price);
    const priceMax = parsePrice(item.priceTo ?? item.price);
    const currency = item.currency || inferCurrency(item.priceFrom || item.price) || null;
    const tags = normalizeTagList(item.tags);

    const eventRecord = {
      title: item.name || item.title || null,
      description: item.description || null,
      start_time: parseDiceDate(item.doorsOpenDate || item.datetime || item.date_unix),
      end_time: parseDiceDate(item.doorsCloseDate || item.endDate),
      city: item.city || city || null,
      latitude: item.latitude || null,
      longitude: item.longitude || null,
      venue_name: item.venue || item.location || item.place || null,
      ticket_url: item.url || null,
      age_restriction: item.ageRestriction || null,
      price_min: priceMin,
      price_max: priceMax,
      currency,
      genres: tags,
      tags: ['dice', ...tags],
      images: item.image ? [{ url: item.image }] : []
    };

    if (!eventRecord.title || !eventRecord.start_time) {
      continue;
    }

    const eventId = await upsertEvent(pool, eventRecord);
    await upsertSourceEvent(pool, {
      source: 'dice',
      source_id: String(sourceId),
      event_id: eventId,
      raw_payload: item
    });
    ingested += 1;
  }

  await updateIngestState(pool, 'dice', city || 'Dublin', startDate, endDate);
  return { source: 'dice', skipped: false, count: ingested };
};

module.exports = {
  ingestTicketmaster,
  ingestEventbrite,
  ingestBandsintownArtists,
  ingestDiceApify,
  upsertEvent,
  upsertSourceEvent
};
