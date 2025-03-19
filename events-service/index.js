// local-events-service/index.js

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

// Adjust these env vars / defaults as needed
const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = process.env.DB_PORT || '3306';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || 'UTav@2523';
const DB_NAME = process.env.DB_NAME || 'gigsdb';
const API_PORT = process.env.API_PORT || 4003;

const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

const app = express();
app.use(cors());
app.use(express.json());

/**
 * GET /events
 * Fetch all local events
 */
app.get('/events', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM local_events');
    res.json(rows);
  } catch (err) {
    console.error('Error fetching local events:', err);
    res.status(500).json({ error: 'Failed to fetch local events' });
  }
});

/**
 * GET /events/:id
 * Fetch one event by ID
 */
app.get('/events/:id', async (req, res) => {
  const eventId = parseInt(req.params.id, 10);
  try {
    const [rows] = await pool.query('SELECT * FROM local_events WHERE id = ?', [eventId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Error retrieving event:', err);
    res.status(500).json({ error: 'Failed to retrieve event' });
  }
});

/**
 * POST /events
 * Create a new local event
 * Body fields: event_name, classification_name, city, date_local, time_local, venue_name, url
 */
app.post('/events', async (req, res) => {
  const {
    event_name,
    classification_name,
    city,
    date_local,
    time_local,
    venue_name,
    url
  } = req.body;

  // event_name is required
  if (!event_name) {
    return res.status(400).json({ error: 'Missing required field: event_name' });
  }

  try {
    const insertSQL = `
      INSERT INTO local_events
        (event_name, classification_name, city, date_local, time_local, venue_name, url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    await pool.execute(insertSQL, [
      event_name,
      classification_name || 'Music',
      city || 'Dublin',
      date_local || null,
      time_local || null,
      venue_name || null,
      url || null
    ]);

    // Return the newly created record (the last inserted row)
    const [latest] = await pool.query('SELECT * FROM local_events ORDER BY id DESC LIMIT 1');
    res.status(201).json(latest[0]);
  } catch (err) {
    console.error('Error creating local event:', err);
    res.status(500).json({ error: 'Failed to create local event' });
  }
});

/**
 * PUT /events/:id
 * Update an existing local event by ID
 */
app.put('/events/:id', async (req, res) => {
  const eventId = parseInt(req.params.id, 10);
  const {
    event_name,
    classification_name,
    city,
    date_local,
    time_local,
    venue_name,
    url
  } = req.body;

  // event_name is still required
  if (!event_name) {
    return res.status(400).json({ error: 'Missing required field: event_name' });
  }

  try {
    // Check if the event exists
    const [existing] = await pool.query('SELECT * FROM local_events WHERE id = ?', [eventId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const updateSQL = `
      UPDATE local_events
         SET event_name = ?,
             classification_name = ?,
             city = ?,
             date_local = ?,
             time_local = ?,
             venue_name = ?,
             url = ?
       WHERE id = ?
    `;
    await pool.execute(updateSQL, [
      event_name,
      classification_name || 'Music',
      city || 'Dublin',
      date_local || null,
      time_local || null,
      venue_name || null,
      url || null,
      eventId
    ]);

    const [updated] = await pool.query('SELECT * FROM local_events WHERE id = ?', [eventId]);
    res.json(updated[0]);
  } catch (err) {
    console.error('Error updating local event:', err);
    res.status(500).json({ error: 'Failed to update local event' });
  }
});

/**
 * DELETE /events/:id
 * Delete a local event by ID
 */
app.delete('/events/:id', async (req, res) => {
  const eventId = parseInt(req.params.id, 10);
  try {
    const [existing] = await pool.query('SELECT * FROM local_events WHERE id = ?', [eventId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    await pool.execute('DELETE FROM local_events WHERE id = ?', [eventId]);
    res.json({ message: 'Event deleted', event: existing[0] });
  } catch (err) {
    console.error('Error deleting local event:', err);
    res.status(500).json({ error: 'Failed to delete local event' });
  }
});

app.listen(API_PORT, () => {
  console.log(`Local Events Service running on port ${API_PORT}`);
});
