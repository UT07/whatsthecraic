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
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-muted">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  const cityChart = computeEventsByCity(events);
  const djChart = computeTopDJsByFee(djs);
  const venueChart = computeEventCountByVenue(events, venues);

  return (
    <div className="space-y-8">
      {/* Personalization & Sync Section */}
      <section className="card animate-fade-up">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="badge mb-3">Get Started</div>
            <h2 className="section-title mb-2">Personalize your feed</h2>
            <p className="section-subtitle">
              Connect Spotify to get smarter recommendations and discover events tailored to your taste.
            </p>
          </div>
          <div className="text-4xl">🎵</div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            className="btn btn-primary"
            href={token ? `${authBase}/auth/spotify/login?token=${token}` : '/auth/login'}
          >
            {spotifyStatus?.linked ? '🔄 Re-link Spotify' : '🎵 Connect Spotify'}
          </a>
          {spotifyStatus?.linked && (
            <button
              className="btn btn-outline"
              onClick={() => authAPI.syncSpotify().catch(() => {})}
            >
              Sync Now
            </button>
          )}
          <a className="btn btn-outline" href="/preferences">
            Customize Preferences
          </a>
        </div>
        <p className="text-muted text-sm mt-4">
          {spotifyStatus?.linked ? `✓ Connected • Last sync: ${spotifyStatus?.last_synced_at || 'pending'}` : 'Not connected yet'}
        </p>
      </section>

      {/* Stats Overview */}
      <section className="grid gap-4 md:grid-cols-3">
        <div className="card animate-fade-up">
          <p className="text-muted text-sm font-semibold">Events (90 days)</p>
          <p className="text-4xl font-bold text-accent mt-2">{events.length}</p>
        </div>
        <div className="card animate-fade-up">
          <p className="text-muted text-sm font-semibold">DJ Profiles</p>
          <p className="text-4xl font-bold text-accent-2 mt-2">{djs.length}</p>
        </div>
        <div className="card animate-fade-up">
          <p className="text-muted text-sm font-semibold">Venues Tracked</p>
          <p className="text-4xl font-bold text-accent-3 mt-2">{venues.length}</p>
        </div>
      </section>

      {/* Charts Section */}
      <section className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <div className="card">
          <h3 className="text-lg font-bold mb-4">Events by City</h3>
          <Doughnut data={cityChart} options={chartOptions} />
        </div>
        <div className="card">
          <h3 className="text-lg font-bold mb-4">Top DJs by Fee</h3>
          <Bar data={djChart} options={chartOptions} />
        </div>
        <div className="card">
          <h3 className="text-lg font-bold mb-4">Events per Venue</h3>
          <Bar data={venueChart} options={chartOptions} />
        </div>
      </section>

      {/* Call to Action */}
      <section className="card bg-gradient-to-r from-accent/10 to-accent-3/10 border-accent/20">
        <div className="text-center py-8">
          <h3 className="section-title mb-2">Ready to explore?</h3>
          <p className="text-muted mb-6">Discover events tailored to your preferences</p>
          <a href="/discover" className="btn btn-primary">
            Start Discovering →
          </a>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
