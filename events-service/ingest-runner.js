const mysql = require('mysql2/promise');
const { ingestTicketmaster, ingestEventbrite } = require('./ingestion');

const DB_HOST = process.env.DB_HOST || 'db';
const DB_PORT = process.env.DB_PORT || '3306';
const DB_USER = process.env.DB_USER || 'app';
const DB_PASSWORD = process.env.DB_PASSWORD || 'app';
const DB_NAME = process.env.DB_NAME || 'gigsdb';

const TICKETMASTER_API_KEY = process.env.TICKETMASTER_API_KEY || null;
const EVENTBRITE_API_TOKEN = process.env.EVENTBRITE_API_TOKEN || null;
const INGESTION_MAX_PAGES = Number.parseInt(process.env.INGESTION_MAX_PAGES || '5', 10);

const city = process.env.INGESTION_DEFAULT_CITY || 'Dublin';
const start = new Date();
const end = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

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
    results.push(await ingestTicketmaster(pool, {
      city,
      startDate: start,
      endDate: end,
      apiKey: TICKETMASTER_API_KEY,
      maxPages: INGESTION_MAX_PAGES
    }));
    results.push(await ingestEventbrite(pool, {
      city,
      startDate: start,
      endDate: end,
      token: EVENTBRITE_API_TOKEN,
      maxPages: INGESTION_MAX_PAGES
    }));

    console.log('Ingestion results:', results);
  } catch (err) {
    console.error('Ingestion failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
