require('dotenv').config({ path: '../.env' });
const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4000;
const TICKETMASTER_API_KEY = process.env.TICKETMASTER_API_KEY;
const VENUE_SERVICE_URL = process.env.VENUE_SERVICE_URL || 'http://venue-service.whatsthecraic.local:4001';
const DJ_SERVICE_URL = process.env.DJ_SERVICE_URL || 'http://dj-service.whatsthecraic.local:4002';
const LOCAL_EVENTS_URL = process.env.LOCAL_EVENTS_URL || 'http://events-service.whatsthecraic.local:4003';

const calculatePopularityScore = (gig, venues, djs) => {
  let score = 0;

  // Score venue
  const venue = venues.find(v => gig.venue.includes(v.name));
  if (venue) score += 10;

  // DJ matching
  gig.djs.forEach(dj => {
    const djMatch = djs.find(d => d.dj_name.toLowerCase() === dj.toLowerCase());
    if (djMatch) {
      score += 10; // DJ match boost
      score += parseInt(djMatch.numeric_fee || 0);
      score += djMatch.total_social_score || 0;
    }
  });

  return score;
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/aggregator-service/api/gigs', async (req, res) => {
  try {
    const [venuesRes, djsRes] = await Promise.all([
      axios.get(`${VENUE_SERVICE_URL}/venues`),
      axios.get(`${DJ_SERVICE_URL}/djs`)
    ]);

    const venues = venuesRes.data;
    const djs = djsRes.data;

    const city = req.query.city || 'Dublin';
    const genre = req.query.genre || 'Electronic';

    // Ticketmaster events
    const tmUrl = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TICKETMASTER_API_KEY}&city=${city}&classificationName=${genre}`;
    const tmRes = await axios.get(tmUrl);
    const tmEvents = tmRes.data._embedded?.events || [];

    const formattedTMEvents = tmEvents.map(event => {
      const venueName = event._embedded?.venues?.[0]?.name || 'Unknown Venue';
      const matchedVenue = venues.find(v => venueName.includes(v.name));
      const matchedDJs = djs.filter(dj => event.name.includes(dj.dj_name));

      return {
        eventName: event.name,
        date: event.dates?.start?.localDate || 'N/A',
        time: event.dates?.start?.localTime || 'N/A',
        venue: matchedVenue ? matchedVenue.name : venueName,
        address: matchedVenue ? matchedVenue.address : 'N/A',
        djs: matchedDJs.map(dj => dj.dj_name),
        ticketLink: event.url,
        isLocal: false,
        popularityScore: calculatePopularityScore(event, venues, djs)
      };
    });

    const formattedLocalEvents = (await axios.get(`${LOCAL_EVENTS_URL}/events`)).data.map(ev => ({
      eventName: ev.event_name,
      date: ev.date_local,
      time: ev.time_local,
      venue: ev.venue_name,
      address: venues.find(v => ev.venue_name.includes(v.name))?.address || 'N/A',
      djs: djs.filter(dj => ev.event_name.includes(dj.dj_name)).map(d => d.dj_name),
      ticketLink: ev.url,
      isLocal: true,
      popularityScore: calculatePopularityScore(ev, venues, djs)
    }));

    const combinedEvents = [
      ...formattedTMEvents.map(event => ({ ...event, source: 'Ticketmaster' })),
      ...formattedLocalEvents
    ];

    combinedEvents.sort((a, b) => b.popularityScore - a.popularityScore);

    return res.json({ gigs: combinedEvents });

  } catch (error) {
    console.error('Error fetching gigs:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Start the server at the very end
app.listen(PORT, () => {
  console.log(`Aggregator running on port ${PORT}`);
});
