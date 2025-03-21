const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 4000;
const TICKETMASTER_API_KEY = process.env.TICKETMASTER_API_KEY || 'ACAYynxFJPKwG12GDFjqNdBqulANzQb8';
const VENUE_SERVICE_URL = process.env.VENUE_SERVICE_URL || 'http://venue-service.whatsthecraic.local:4001';
const DJ_SERVICE_URL = process.env.DJ_SERVICE_URL || 'http://dj-service.whatsthecraic.local:4002';
const LOCAL_EVENTS_URL = process.env.LOCAL_EVENTS_URL || 'http://events-service.whatsthecraic.local:4003';

const calculatePopularityScore = (gig, venues, djs) => {
  let score = 0;
  if (gig.venue) {
    const venue = venues.find(v => gig.venue.includes(v.name));
    if (venue) score += 10;
  }
  if (Array.isArray(gig.djs)) {
    gig.djs.forEach(dj => {
      const djMatch = djs.find(d => d.dj_name.toLowerCase() === dj.toLowerCase());
      if (djMatch) {
        score += 10;
        score += parseInt(djMatch.numeric_fee || 0);
        score += djMatch.total_social_score || 0;
      }
    });
  }
  return score;
};

const normalize = str => str?.toLowerCase().trim();

app.get('/api/gigs', async (req, res) => {
  try {
    const [venuesRes, djsRes] = await Promise.all([
      axios.get(`${VENUE_SERVICE_URL}/venues`),
      axios.get(`${DJ_SERVICE_URL}/djs`)
    ]);

    const venues = venuesRes.data;
    const djs = djsRes.data;

    const city = req.query.city || 'Dublin';
    const genre = normalize(req.query.genre);
    const djName = normalize(req.query.djName);
    const venueName = normalize(req.query.venue);

    let tmEvents = [];
    try {
      const tmUrl = `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TICKETMASTER_API_KEY}&city=${city}${genre ? `&classificationName=${genre}` : ''}`;
      const tmRes = await axios.get(tmUrl);
      tmEvents = tmRes.data._embedded?.events || [];
    } catch (err) {
      if (err.response?.status === 429) {
        console.warn('Ticketmaster API rate limit reached.');
      } else {
        throw err;
      }
    }

    const formattedTMEvents = tmEvents.map(event => {
      const eventName = event.name;
      const venueNameTM = event._embedded?.venues?.[0]?.name || 'Unknown Venue';
      const matchedVenue = venues.find(v => normalize(venueNameTM).includes(normalize(v.name)));
      const matchedDJs = djs.filter(dj =>
        normalize(eventName).includes(normalize(dj.dj_name)) ||
        normalize(dj.dj_name).includes(normalize(eventName))
      );

      return {
        eventName,
        date: event.dates?.start?.localDate || 'N/A',
        time: event.dates?.start?.localTime || 'N/A',
        venue: matchedVenue ? matchedVenue.name : venueNameTM,
        address: matchedVenue ? matchedVenue.address : 'N/A',
        djs: matchedDJs.map(dj => dj.dj_name),
        ticketLink: event.url,
        isLocal: false,
        popularityScore: calculatePopularityScore(event, venues, djs),
        source: 'Ticketmaster'
      };
    });

    const localRawEvents = (await axios.get(`${LOCAL_EVENTS_URL}/events`)).data;

    const formattedLocalEvents = localRawEvents.map(ev => {
      const matchedVenue = venues.find(v => normalize(ev.venue_name || '').includes(normalize(v.name)));
      const matchedDJs = djs.filter(dj =>
        normalize(ev.event_name).includes(normalize(dj.dj_name)) ||
        normalize(dj.dj_name).includes(normalize(ev.event_name))
      );

      return {
        eventName: ev.event_name || 'N/A',
        date: ev.date_local || 'N/A',
        time: ev.time_local || 'N/A',
        venue: ev.venue_name || 'Unknown Venue',
        address: matchedVenue ? matchedVenue.address : 'N/A',
        djs: matchedDJs.map(d => d.dj_name),
        ticketLink: ev.url || '#',
        isLocal: true,
        popularityScore: calculatePopularityScore(ev, venues, djs),
        source: 'Local'
      };
    });

    const matchesFilters = (event) => {
      let matches = true;
      if (djName) {
        matches = matches && event.djs.some(d => normalize(d).includes(djName));
      }
      if (venueName) {
        matches = matches && normalize(event.venue).includes(venueName);
      }
      if (genre) {
        matches = matches && normalize(event.eventName).includes(genre);
      }
      return matches;
    };

    const filteredTMEvents = formattedTMEvents.filter(matchesFilters);
    const filteredLocalEvents = formattedLocalEvents.filter(matchesFilters);

    const finalEvents = (filteredTMEvents.length > 0)
      ? [...filteredTMEvents.sort((a, b) => b.popularityScore - a.popularityScore),
         ...filteredLocalEvents.sort((a, b) => b.popularityScore - a.popularityScore)]
      : [...filteredLocalEvents.sort((a, b) => b.popularityScore - a.popularityScore),
         ...filteredTMEvents.sort((a, b) => b.popularityScore - a.popularityScore)];

    return res.json({ gigs: finalEvents });

  } catch (error) {
    console.error('Error fetching gigs:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => console.log(`Aggregator running on port ${PORT}`));
