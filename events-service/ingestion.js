const axios = require('axios');
const crypto = require('crypto');

const http = axios.create({ timeout: 10000 });

const toMysqlDateTime = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 19).replace('T', ' ');
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

const ingestTicketmaster = async (pool, { city, startDate, endDate, apiKey, maxPages = 5 }) => {
  if (!apiKey) {
    return { source: 'ticketmaster', skipped: true, reason: 'missing_api_key', count: 0 };
  }

  let page = 0;
  let ingested = 0;
  let totalPages = 1;

  const startDateTime = new Date(startDate).toISOString();
  const endDateTime = new Date(endDate).toISOString();

  while (page < totalPages && page < maxPages) {
    const url = 'https://app.ticketmaster.com/discovery/v2/events.json';
    const response = await http.get(url, {
      params: {
        apikey: apiKey,
        city,
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

const ingestEventbrite = async (pool, { city, startDate, endDate, token, maxPages = 5 }) => {
  if (!token) {
    return { source: 'eventbrite', skipped: true, reason: 'missing_api_token', count: 0 };
  }

  let page = 1;
  let ingested = 0;
  let hasMore = true;

  const startDateTime = new Date(startDate).toISOString();
  const endDateTime = new Date(endDate).toISOString();

  while (hasMore && page <= maxPages) {
    const response = await http.get('https://www.eventbriteapi.com/v3/events/search/', {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        'location.address': city,
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

module.exports = {
  ingestTicketmaster,
  ingestEventbrite,
  upsertEvent,
  upsertSourceEvent
};
