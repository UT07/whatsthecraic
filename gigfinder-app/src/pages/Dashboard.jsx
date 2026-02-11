import React, { useEffect, useState } from 'react';
import { Doughnut, Bar } from 'react-chartjs-2';
import { Chart, registerables } from 'chart.js';
import eventsAPI from '../services/eventsAPI';
import djAPI from '../services/djAPI';
import venueAPI from '../services/venueAPI';
import authAPI from '../services/authAPI';
import { getToken } from '../services/apiClient';

Chart.register(...registerables);
Chart.defaults.font.family = 'Space Grotesk, system-ui, sans-serif';
Chart.defaults.color = '#c7d0d9';

const chartOptions = {
  plugins: {
    legend: {
      labels: { font: { size: 13 } }
    },
    tooltip: {
      bodyFont: { size: 13 },
      titleFont: { size: 14 }
    }
  },
  layout: { padding: 12 }
};

const computeEventsByCity = (events = []) => {
  const cityCount = {};
  events.forEach(event => {
    if (event.city) {
      const city = event.city.trim();
      cityCount[city] = (cityCount[city] || 0) + 1;
    }
  });
  const labels = Object.keys(cityCount);
  const data = labels.map(city => cityCount[city]);
  const palette = [
    '#00f5a0',
    '#00c2ff',
    '#ffb454',
    '#ff6b6b',
    '#8c7bff',
    '#3c455a'
  ];
  return {
    labels,
    datasets: [{ label: 'Events by City', data, backgroundColor: labels.map((_, i) => palette[i % palette.length]) }]
  };
};

const computeTopDJsByFee = (djs = []) => {
  const sorted = djs
    .filter(dj => dj.numeric_fee !== null && dj.numeric_fee !== undefined)
    .sort((a, b) => parseFloat(b.numeric_fee) - parseFloat(a.numeric_fee))
    .slice(0, 5);
  return {
    labels: sorted.map(dj => dj.dj_name),
    datasets: [
      {
        label: 'Top DJs by Fee',
        data: sorted.map(dj => parseFloat(dj.numeric_fee)),
        backgroundColor: '#00c2ff'
      }
    ]
  };
};

const computeEventCountByVenue = (events = [], venues = []) => {
  const venueEventCount = {};
  events.forEach(event => {
    if (event.venue_name) {
      const venueName = event.venue_name.trim().toLowerCase();
      venueEventCount[venueName] = (venueEventCount[venueName] || 0) + 1;
    }
  });
  const labels = venues.map(venue => venue.name);
  const data = labels.map(label => {
    const key = label.trim().toLowerCase();
    return venueEventCount[key] || 0;
  });
  return {
    labels,
    datasets: [{ label: 'Events per Venue', data, backgroundColor: '#00f5a0' }]
  };
};

const Dashboard = () => {
  const [events, setEvents] = useState([]);
  const [djs, setDjs] = useState([]);
  const [venues, setVenues] = useState([]);
  const [spotifyStatus, setSpotifyStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const token = getToken();
  const authBase = process.env.REACT_APP_AUTH_BASE || 'https://auth.whatsthecraic.run.place';

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [eventsRes, djsRes, venuesRes] = await Promise.all([
          eventsAPI.searchEvents({}),
          djAPI.getAllDJs(),
          venueAPI.getAllVenues()
        ]);
        setEvents(eventsRes.events || []);
        setDjs(Array.isArray(djsRes) ? djsRes : []);
        setVenues(Array.isArray(venuesRes) ? venuesRes : []);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    const loadSpotify = async () => {
      if (!token) return;
      try {
        const status = await authAPI.getSpotifyStatus();
        setSpotifyStatus(status);
      } catch (error) {
        setSpotifyStatus(null);
      }
    };
    loadSpotify();
  }, [token]);

  if (loading) {
    return (
      <div className="card max-w-md mx-auto text-center">
        <p className="text-muted">Loading your insights...</p>
      </div>
    );
  }

  const cityChart = computeEventsByCity(events);
  const djChart = computeTopDJsByFee(djs);
  const venueChart = computeEventCountByVenue(events, venues);

  return (
    <div className="space-y-8">
      <section className="grid-auto">
        <div className="card animate-fade-up">
          <div className="badge mb-3">Personalization</div>
          <h2 className="section-title mb-2">Morning brief</h2>
          <p className="section-subtitle">
            See the hottest drops in your cities, then sync Spotify to sharpen the feed.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              className="btn btn-primary"
              href={token ? `${authBase}/auth/spotify/login?token=${token}` : '/auth/login'}
            >
              {spotifyStatus?.linked ? 'Re-link Spotify' : 'Connect Spotify'}
            </a>
            <button
              className="btn btn-outline"
              onClick={() => authAPI.syncSpotify().catch(() => {})}
              disabled={!spotifyStatus?.linked}
            >
              Sync Now
            </button>
            <a className="btn btn-outline" href="/preferences">
              Edit Preferences
            </a>
          </div>
          <p className="text-muted text-sm mt-3">
            {spotifyStatus?.linked ? `Linked · last sync ${spotifyStatus?.last_synced_at || 'pending'}` : 'Not linked yet'}
          </p>
        </div>

        <div className="card animate-fade-up">
          <div className="badge mb-3">At a glance</div>
          <div className="grid gap-4">
            <div>
              <p className="text-muted text-sm">Events (next 90 days)</p>
              <p className="text-3xl font-semibold">{events.length}</p>
            </div>
            <div>
              <p className="text-muted text-sm">DJ profiles</p>
              <p className="text-3xl font-semibold">{djs.length}</p>
            </div>
            <div>
              <p className="text-muted text-sm">Venues tracked</p>
              <p className="text-3xl font-semibold">{venues.length}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid-auto">
        <div className="card">
          <h3 className="text-lg font-semibold mb-3">Events by City</h3>
          <Doughnut data={cityChart} options={chartOptions} />
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold mb-3">Top DJs by Fee</h3>
          <Bar data={djChart} options={chartOptions} />
        </div>
        <div className="card">
          <h3 className="text-lg font-semibold mb-3">Events per Venue</h3>
          <Bar data={venueChart} options={chartOptions} />
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
