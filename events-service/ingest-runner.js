const mysql = require('mysql2/promise');
const { ingestTicketmaster, ingestEventbrite, ingestBandsintownArtists, ingestDiceApify } = require('./ingestion');

const DB_HOST = process.env.DB_HOST || 'db';
const DB_PORT = process.env.DB_PORT || '3306';
const DB_USER = process.env.DB_USER || 'app';
const DB_PASSWORD = process.env.DB_PASSWORD || 'app';
const DB_NAME = process.env.DB_NAME || 'gigsdb';

const TICKETMASTER_API_KEY = process.env.TICKETMASTER_API_KEY || null;
const TICKETMASTER_COUNTRY_CODE = process.env.TICKETMASTER_COUNTRY_CODE || null;
const EVENTBRITE_API_TOKEN = process.env.EVENTBRITE_API_TOKEN || null;
const EVENTBRITE_ORG_IDS = process.env.EVENTBRITE_ORG_IDS
  ? process.env.EVENTBRITE_ORG_IDS.split(',').map(id => id.trim()).filter(Boolean)
  : null;
const DICE_APIFY_ENABLED = (process.env.DICE_APIFY_ENABLED || 'false') === 'true';
const DICE_APIFY_ACTOR = process.env.DICE_APIFY_ACTOR || 'lexis-solutions~dice-fm';
const DICE_APIFY_MAX_ITEMS = Number.parseInt(process.env.DICE_APIFY_MAX_ITEMS || '200', 10);
const DICE_APIFY_USE_PROXY = (process.env.DICE_APIFY_USE_PROXY || 'true') === 'true';
const APIFY_TOKEN = process.env.APIFY_TOKEN || null;
const INGESTION_MAX_PAGES = Number.parseInt(process.env.INGESTION_MAX_PAGES || '5', 10);
const BANDSINTOWN_APP_ID = process.env.BANDSINTOWN_APP_ID || null;
const BANDSINTOWN_MAX_ARTISTS = Number.parseInt(process.env.BANDSINTOWN_MAX_ARTISTS || '15', 10);
const BANDSINTOWN_MAX_EVENTS = Number.parseInt(process.env.BANDSINTOWN_MAX_EVENTS || '300', 10);
const BANDSINTOWN_SEED_ARTISTS = process.env.BANDSINTOWN_SEED_ARTISTS
  ? process.env.BANDSINTOWN_SEED_ARTISTS.split(',').map(name => name.trim()).filter(Boolean)
  : [];
const BANDSINTOWN_ALLOW_ANY_ARTIST = (process.env.BANDSINTOWN_ALLOW_ANY_ARTIST || 'false') === 'true';

const city = process.env.INGESTION_DEFAULT_CITY || 'Dublin';
const start = new Date();
const end = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

const safeIngest = async (name, fn) => {
  try {
    const result = await fn();
    console.log(`[${name}] OK:`, result);
    return result;
  } catch (err) {
    console.error(`[${name}] FAILED:`, err.message);
    return { source: name, skipped: true, reason: 'error', error: err.message, count: 0 };
  }
};

(async () => {
  const pool = mysql.createPool({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10
  });

  try {
    const results = [];

    results.push(await safeIngest('ticketmaster', () => ingestTicketmaster(pool, {
      city,
      startDate: start,
      endDate: end,
      apiKey: TICKETMASTER_API_KEY,
      countryCode: TICKETMASTER_COUNTRY_CODE,
      maxPages: INGESTION_MAX_PAGES
    })));

    results.push(await safeIngest('eventbrite', () => ingestEventbrite(pool, {
      city,
      startDate: start,
      endDate: end,
      token: EVENTBRITE_API_TOKEN,
      orgIds: EVENTBRITE_ORG_IDS,
      maxPages: INGESTION_MAX_PAGES
    })));

    if (BANDSINTOWN_APP_ID && BANDSINTOWN_SEED_ARTISTS.length) {
      results.push(await safeIngest('bandsintown', () => ingestBandsintownArtists(pool, {
        artists: BANDSINTOWN_SEED_ARTISTS.slice(0, BANDSINTOWN_MAX_ARTISTS),
        appId: BANDSINTOWN_APP_ID,
        startDate: start,
        endDate: end,
        city: null,
        maxArtists: BANDSINTOWN_MAX_ARTISTS,
        maxEvents: BANDSINTOWN_MAX_EVENTS
      })));
    } else {
      results.push({ source: 'bandsintown', skipped: true, reason: 'no_seed_artists', count: 0 });
    }

    results.push(await safeIngest('dice', () => ingestDiceApify(pool, {
      city,
      startDate: start,
      endDate: end,
      enabled: DICE_APIFY_ENABLED,
      actorId: DICE_APIFY_ACTOR,
      apifyToken: APIFY_TOKEN,
      maxItems: DICE_APIFY_MAX_ITEMS,
      useProxy: DICE_APIFY_USE_PROXY
    })));

    console.log('Ingestion results:', JSON.stringify(results, null, 2));

    const failed = results.filter(r => r.reason === 'error');
    if (failed.length === results.length) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Ingestion failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
