// venue-service/index.js

const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

// 1. Environment variables or hardcode your Docker MySQL creds
//    For Docker on localhost, typically: 127.0.0.1:3306
const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = process.env.DB_PORT || '3306';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || 'UTav@2523';
const DB_NAME = process.env.DB_NAME || 'gigsdb';

// 2. Create a connection pool
const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const app = express();
app.use(express.json());
app.use(cors());

const router = express.Router();
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});


// GET /venues => SELECT * FROM venues
app.get('/venues', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM venues');
    res.json(rows);
  } catch (err) {
    console.error('Error fetching venues:', err);
    res.status(500).json({ error: 'Failed to fetch venues' });
  }
});

// GET /venues/:id => SELECT * FROM venues WHERE id=?
app.get('/venues/:id', async (req, res) => {
  const venueId = parseInt(req.params.id, 10);
  try {
    const [rows] = await pool.query('SELECT * FROM venues WHERE id = ?', [venueId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Venue not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Error retrieving venue:', err);
    res.status(500).json({ error: 'Failed to retrieve venue' });
  }
});

// POST /venues => INSERT a new venue
app.post('/venues', async (req, res) => {
  const { id, name, address, capacity, genreFocus, latitude, longitude, notes } = req.body;

  if (!id || !name || !address) {
    return res.status(400).json({ error: 'Missing required fields: id, name, address' });
  }

  try {
    await pool.query(
      `INSERT INTO venues
        (id, name, address, capacity, genreFocus, latitude, longitude, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        address,
        capacity || 100,
        genreFocus || 'Various',
        latitude || 53.0,
        longitude || -6.0,
        notes || '',
      ]
    );

    // Return the newly created record
    const [rows] = await pool.query('SELECT * FROM venues WHERE id = ?', [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error creating venue:', err);
    res.status(500).json({ error: 'Failed to create venue. Possibly duplicate ID?' });
  }
});

// PUT /venues/:id => UPDATE an existing venue
app.put('/venues/:id', async (req, res) => {
  const venueId = parseInt(req.params.id, 10);
  const { name, address, capacity, genreFocus, latitude, longitude, notes } = req.body;

  if (!name || !address) {
    return res.status(400).json({ error: 'Missing required fields: name, address' });
  }

  try {
    // Check if the venue exists
    const [existing] = await pool.query('SELECT * FROM venues WHERE id = ?', [venueId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Venue not found' });
    }

    await pool.query(
      `UPDATE venues
         SET name = ?, address = ?, capacity = ?, genreFocus = ?, latitude = ?, longitude = ?, notes = ?
       WHERE id = ?`,
      [
        name,
        address,
        capacity || 100,
        genreFocus || 'Various',
        latitude || 53.0,
        longitude || -6.0,
        notes || '',
        venueId
      ]
    );

    // Return the updated record
    const [updated] = await pool.query('SELECT * FROM venues WHERE id = ?', [venueId]);
    res.json(updated[0]);
  } catch (err) {
    console.error('Error updating venue:', err);
    res.status(500).json({ error: 'Failed to update venue' });
  }
});

// DELETE /venues/:id => remove a venue by ID
app.delete('/venues/:id', async (req, res) => {
  const venueId = parseInt(req.params.id, 10);

  try {
    // Check if it exists
    const [existing] = await pool.query('SELECT * FROM venues WHERE id = ?', [venueId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Venue not found' });
    }

    await pool.query('DELETE FROM venues WHERE id = ?', [venueId]);
    res.json({ message: 'Venue deleted', venue: existing[0] });
  } catch (err) {
    console.error('Error deleting venue:', err);
    res.status(500).json({ error: 'Failed to delete venue' });
  }
});

app.use('/venue-service', router);
// 4. Start the server
const PORT = process.env.PORT || 4001;
app.listen(PORT, () => {
  console.log(`Venue Service listening on port ${PORT}`);
});
