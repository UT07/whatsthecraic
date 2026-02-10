const axios = require('axios');
const crypto = require('crypto');

const http = axios.create({ timeout: 10000 });
const XRAVES_SCRAPER_TIMEOUT_MS = Number.parseInt(
  process.env.XRAVES_SCRAPER_TIMEOUT_MS || '30000',
  10
);

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

const extractXravesNextData = (html) => {
  if (!html) return null;
  const match = html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i);
  if (!match || !match[1]) return null;
  return safeJsonParse(match[1].trim());
};

const extractXravesEvents = (nextData) => {
  const fallback = nextData?.props?.pageProps?.fallback;
  if (!fallback || typeof fallback !== 'object') return [];
  const candidates = [];
  const collect = (value) => {
    if (!value) return;
    if (Array.isArray(value)) {
      candidates.push(...value);
      return;
    }
    if (typeof value === 'object') {
      if (Array.isArray(value.data)) {
        candidates.push(...value.data);
        return;
      }
      for (const nested of Object.values(value)) {
        collect(nested);
      }
    }
  };
  for (const value of Object.values(fallback)) {
    collect(value);
  }
  return candidates.filter(item => {
    const attrs = item?.attributes;
    return attrs?.name && (attrs?.startDateTime || attrs?.start_date || attrs?.eventUrl);
  });
};

const resolveUrl = (baseUrl, value) => {
  if (!value || typeof value !== 'string') return null;
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  if (!baseUrl) return value;
  const trimmedBase = baseUrl.replace(/\/+$/, '');
  const trimmedValue = value.startsWith('/') ? value : `/${value}`;
  return `${trimmedBase}${trimmedValue}`;
};

const extractXravesImages = (attrs) => {
  const images = [];
  const pushUrl = (url) => {
    if (url && typeof url === 'string') {
      images.push({ url });
    }
  };
  const eventImage = attrs?.eventImage;
  if (typeof eventImage === 'string') {
    pushUrl(eventImage);
    return images;
  }
  pushUrl(eventImage?.url);
  pushUrl(eventImage?.data?.attributes?.url);
  const formats = eventImage?.data?.attributes?.formats;
  if (formats && typeof formats === 'object') {
    Object.values(formats).forEach(format => pushUrl(format?.url));
  }
  return images;
};

const stripTrailingSlash = (value) => {
  if (!value || typeof value !== 'string') return value;
  return value.endsWith('/') ? value.slice(0, -1) : value;
};

const fetchXravesNextData = async ({ baseUrl, userAgent, scraperUrl }) => {
  if (scraperUrl) {
    try {
      const response = await http.post(
        `${stripTrailingSlash(scraperUrl)}/scrape`,
        { url: baseUrl, userAgent },
        { timeout: XRAVES_SCRAPER_TIMEOUT_MS }
      );
      const nextData = response.data?.nextData || response.data?.next_data || response.data?.data;
      if (nextData && typeof nextData === 'object') {
        return nextData;
      }
      if (typeof nextData === 'string') {
        return safeJsonParse(nextData);
      }
    } catch (error) {
      console.warn('XRaves scraper failed, falling back to direct fetch:', error.message);
    }
  }

  const headers = {
    'User-Agent': userAgent || 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  };
  const response = await http.get(baseUrl, { headers });
  return extractXravesNextData(response.data);
};

const ingestXraves = async (pool, { baseUrl, userAgent, scraperUrl, city, startDate, endDate, enabled = true }) => {
  if (!enabled) {
    return { source: 'xraves', skipped: true, reason: 'disabled', count: 0 };
  }

  const resolvedBaseUrl = baseUrl || 'https://xraves.ie/';
  const nextData = await fetchXravesNextData({
    baseUrl: resolvedBaseUrl,
    userAgent,
    scraperUrl
  });
  if (!nextData) {
    return { source: 'xraves', skipped: true, reason: 'missing_next_data', count: 0 };
  }

  const events = extractXravesEvents(nextData);
  const seen = new Set();
  let ingested = 0;

  for (const item of events) {
    const sourceId = item?.id ? String(item.id) : null;
    if (!sourceId || seen.has(sourceId)) {
      continue;
    }
    seen.add(sourceId);

    const attrs = item.attributes || {};
    const venue = attrs.venue || {};
    const venueLocation = safeJsonParse(venue.venueLocation);
    const address = venueLocation?.address || venueLocation || {};
    const cityName =
      address.addressLocality ||
      address.locality ||
      venue.venueCounty ||
      city ||
      null;

    const eventRecord = {
      title: attrs.name || null,
      description: attrs.eventDescription || attrs.description || null,
      start_time: toMysqlDateTime(attrs.startDateTime || attrs.start_date),
      end_time: toMysqlDateTime(attrs.endDateTime || attrs.end_date),
      city: cityName,
      latitude: venue.venueLat || address?.geo?.latitude || null,
      longitude: venue.venueLng || address?.geo?.longitude || null,
      venue_name: venue.venueName || null,
      ticket_url: resolveUrl(resolvedBaseUrl, attrs.eventUrl),
      age_restriction: null,
      price_min: null,
      price_max: null,
      currency: null,
      genres: (attrs.genres?.data || [])
        .map(item => item?.attributes?.genreName || item?.attributes?.name)
        .filter(Boolean)
        .map(value => value.toLowerCase()),
      tags: ['xraves'],
      images: extractXravesImages(attrs)
    };

    if (!eventRecord.title || !eventRecord.start_time) {
      continue;
    }

    const eventId = await upsertEvent(pool, eventRecord);
    await upsertSourceEvent(pool, {
      source: 'xraves',
      source_id: sourceId,
      event_id: eventId,
      raw_payload: item
    });
    ingested += 1;
  }

  await updateIngestState(pool, 'xraves', city || 'Ireland', startDate, endDate);
  return { source: 'xraves', skipped: false, count: ingested };
};

module.exports = {
  ingestTicketmaster,
  ingestEventbrite,
  ingestXraves,
  upsertEvent,
  upsertSourceEvent
};
