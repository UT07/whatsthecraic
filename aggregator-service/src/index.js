// aggregator-service/src/index.js

const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());
const router = express.Router();
// Hardcoded or from env
const PORT = process.env.PORT || 4000;
const TICKETMASTER_API_KEY = process.env.TICKETMASTER_API_KEY || 'ACAYynxFJPKwG12GDFjqNdBqulANzQb8';

const VENUE_SERVICE_URL = process.env.VENUE_SERVICE_URL || 'http://venue-service.whatsthecraic.local:4001';
const DJ_SERVICE_URL = process.env.DJ_SERVICE_URL || 'http://dj-service.whatsthecraic.local:4002';
const LOCAL_EVENTS_URL = process.env.LOCAL_EVENTS_URL || 'http://events-service.whatsthecraic.local:4003';

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  

// GET /api/gigs => first see if TM yields any filtered events, else fallback to local
app.get('/api/gigs', async (req, res) => {
  try {
    // 1) fetch local venues & DJs (for naive matching)
    const [venuesRes, djsRes] = await Promise.all([
      axios.get(`${VENUE_SERVICE_URL}/venues`),
      axios.get(`${DJ_SERVICE_URL}/djs`)
    ]);
    const venues = venuesRes.data;
    const djs = djsRes.data;

    // 2) read city & genre from query
    const city = req.query.city || 'Dublin';
    const genre = req.query.genre || 'Electronic';

    // 3) fetch Ticketmaster events
    const tmUrl = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TICKETMASTER_API_KEY}&city=${city}&classificationName=${genre}`;
    const tmRes = await axios.get(tmUrl);
    const tmEvents = tmRes.data._embedded?.events || [];

    // convert the raw TM events for naive local matching
    const tmFormatted = tmEvents.map(event => {
      // find local venue
      const venueName = event._embedded?.venues?.[0]?.name || 'Unknown Venue';
      const matchedVenue = venues.find(v => venueName.includes(v.name));
      // find local DJs
      const matchedDJs = djs.filter(dj => event.name.includes(dj.dj_name));

      return {
        eventName: event.name,
        date: event.dates?.start?.localDate || 'N/A',
        time: event.dates?.start?.localTime || 'N/A',
        venue: matchedVenue ? matchedVenue.name : venueName,
        address: matchedVenue ? matchedVenue.address : 'N/A',
        djs: matchedDJs.map(dj => dj.dj_name),
        ticketLink: event.url,
        isLocal: false
      };
    });

    // 4) apply djName & venueName filters to the TM set
    let finalTM = tmFormatted;
    const requestedDJ = req.query.djName;
    if (requestedDJ) {
      finalTM = finalTM.filter(gig =>
        gig.djs.some(d => d.toLowerCase() === requestedDJ.toLowerCase())
      );
    }

    const requestedVenue = req.query.venueName;
    if (requestedVenue) {
      finalTM = finalTM.filter(gig =>
        gig.venue.toLowerCase().includes(requestedVenue.toLowerCase())
      );
    }

    // 5) if finalTM is non-empty, return it
    if (finalTM.length > 0) {
      return res.json({ gigs: finalTM, source: 'Ticketmaster' });
    }

    // 6) otherwise, fallback => local events
    // fetch them from local events DB
    const localRes = await axios.get(`${LOCAL_EVENTS_URL}/events`);
    const localEvents = localRes.data; // array from DB

    // map local events to a uniform shape & do the same naive matching
    const localMapped = localEvents.map(ev => {
      const matchedVenue = venues.find(v => ev.venue_name.includes(v.name));
      const matchedDJs   = djs.filter(dj => ev.event_name.includes(dj.dj_name));

      return {
        eventName: ev.event_name,
        date: ev.date_local || 'N/A',
        time: ev.time_local || 'N/A',
        venue: matchedVenue ? matchedVenue.name : ev.venue_name,
        address: matchedVenue ? matchedVenue.address : 'N/A',
        djs: matchedDJs.map(dj => dj.dj_name),
        ticketLink: ev.url || '#',
        isLocal: true
      };
    });

    // 7) apply the same filters to local => djName & venueName
    let finalLocal = localMapped;
    if (requestedDJ) {
      finalLocal = finalLocal.filter(gig =>
        gig.djs.some(d => d.toLowerCase() === requestedDJ.toLowerCase())
      );
    }
    if (requestedVenue) {
      finalLocal = finalLocal.filter(gig =>
        gig.venue.toLowerCase().includes(requestedVenue.toLowerCase())
      );
    }

    return res.json({ gigs: finalLocal, source: 'LocalDB' });
  } catch (err) {
    console.error('Aggregator fallback error:', err.message);
    res.status(500).json({ error: err.message });
  }
});
app.use('/aggregator-service', router);
app.listen(PORT, () => {
  console.log(`Fallback aggregator running on port ${PORT}`);
});
