/**
 * importLocalEvents.js
 *
 * Usage:
 *   1) npm install axios
 *   2) node importLocalEvents.js
 *
 * This script:
 *   - Reads a JSON file (e.g., localEvents.json) that contains an array of event objects
 *   - For each event, POSTs it to the local events service at http://localhost:4003/events
 *   - Each event must have at least "event_name" to satisfy the local events service schema
 */

const fs = require('fs');
const axios = require('axios');

// Adjust if your local events service uses a different port or path
const EVENTS_API_URL = 'http://localhost:4003/events';

// The path to your local events JSON file (an array of event objects)
const JSON_FILE_PATH = 'localEvents.json';

(async () => {
  try {
    // 1) Read and parse the JSON file
    const fileContent = fs.readFileSync(JSON_FILE_PATH, 'utf8');
    const eventsArray = JSON.parse(fileContent);

    if (!Array.isArray(eventsArray)) {
      throw new Error('JSON file does not contain an array');
    }

    console.log(`Read ${eventsArray.length} events from ${JSON_FILE_PATH}.`);

    // 2) For each event, send a POST request to /events
    let count = 0;
    for (const evt of eventsArray) {
      // We assume each event object matches the local events schema fields:
      //  {
      //    "event_name": "Some Name",
      //    "classification_name": "Music",
      //    "city": "Dublin",
      //    "date_local": "2024-01-15",
      //    "time_local": "20:30:00",
      //    "venue_name": "Wigwam",
      //    "url": "https://..."
      //  }

      // event_name is required in your local events service
      if (!evt.event_name) {
        console.log(`Skipping an event missing "event_name":`, evt);
        continue;
      }

      try {
        const res = await axios.post(EVENTS_API_URL, evt, {
          headers: { 'Content-Type': 'application/json' }
        });
        console.log(
          `Created event ID = ${res.data.id}, name = "${res.data.event_name}"`
        );
        count++;
      } catch (error) {
        // If there's an issue with a specific event, log it and continue
        console.error(
          `Error creating event "${evt.event_name}" =>`,
          error.response?.data || error.message
        );
      }
    }

    console.log(`Inserted ${count} events successfully!`);
  } catch (err) {
    console.error('Error importing local events:', err.message);
  }
})();
