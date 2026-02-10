import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import eventsAPI from '../services/eventsAPI';
import { getToken } from '../services/apiClient';

const formatDate = (iso) => {
  if (!iso) return 'TBA';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'TBA';
  return date.toLocaleString('en-IE', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const CombinedGigs = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('feed');
  const [savedIds, setSavedIds] = useState(new Set());
  const token = getToken();

  const [filters, setFilters] = useState({
    city: '',
    from: '',
    to: '',
    genres: '',
    priceMax: '',
    source: ''
  });

  const activeFilters = useMemo(() => {
    const clean = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value) clean[key] = value;
    });
    return clean;
  }, [filters]);

  const loadFeed = async () => {
    setLoading(true);
    try {
      const data = await eventsAPI.getFeed(activeFilters);
      setEvents(data.events || []);
    } catch (error) {
      console.error('Feed error:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const runSearch = async () => {
    setLoading(true);
    try {
      const data = await eventsAPI.searchEvents(activeFilters);
      setEvents(data.events || []);
    } catch (error) {
      console.error('Search error:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (mode === 'feed') {
      loadFeed();
    }
  }, [mode]);

  const handleSave = async (id) => {
    try {
      await eventsAPI.saveEvent(id);
      setSavedIds(prev => new Set([...prev, id]));
    } catch (error) {
      console.error('Save failed:', error);
    }
  };

  return (
    <div className="space-y-8">
      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="badge mb-2">Discover</div>
            <h1 className="section-title">Your next night out</h1>
            <p className="section-subtitle">
              Personalize with Spotify, or run a targeted search across Dublin and beyond.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              className={`btn ${mode === 'feed' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setMode('feed')}
              disabled={!token}
            >
              For You
            </button>
            <button
              className={`btn ${mode === 'search' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setMode('search')}
            >
              Search
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <input
            className="input"
            placeholder="City (ex: Dublin)"
            value={filters.city}
            onChange={(e) => setFilters({ ...filters, city: e.target.value })}
          />
          <input
            className="input"
            placeholder="Genres (comma separated)"
            value={filters.genres}
            onChange={(e) => setFilters({ ...filters, genres: e.target.value })}
          />
          <select
            className="input"
            value={filters.source}
            onChange={(e) => setFilters({ ...filters, source: e.target.value })}
          >
            <option value="">All sources</option>
            <option value="ticketmaster">Ticketmaster</option>
            <option value="eventbrite">Eventbrite</option>
            <option value="xraves">XRaves</option>
            <option value="local">Manual</option>
          </select>
          <input
            className="input"
            type="date"
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          />
          <input
            className="input"
            type="date"
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          />
          <input
            className="input"
            type="number"
            placeholder="Max price (EUR)"
            value={filters.priceMax}
            onChange={(e) => setFilters({ ...filters, priceMax: e.target.value })}
          />
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button className="btn btn-primary" onClick={mode === 'feed' ? loadFeed : runSearch}>
            {mode === 'feed' ? 'Refresh Feed' : 'Run Search'}
          </button>
          <button
            className="btn btn-outline"
            onClick={() => setFilters({ city: '', from: '', to: '', genres: '', priceMax: '', source: '' })}
          >
            Clear filters
          </button>
          {!token && <span className="chip">Login to unlock "For You"</span>}
        </div>
      </section>

      <section className="grid-auto">
        {loading ? (
          <div className="card text-center text-muted">Loading events…</div>
        ) : events.length === 0 ? (
          <div className="card text-center text-muted">No events found for these filters.</div>
        ) : (
          events.map((event, index) => {
            const image = event.images?.[0]?.url;
            const saved = savedIds.has(event.id);
            return (
              <motion.article
                key={`${event.id}-${index}`}
                className="card flex flex-col gap-4"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: index * 0.03 }}
              >
                {image && (
                  <div
                    className="w-full h-40 rounded-xl bg-cover bg-center"
                    style={{ backgroundImage: `url(${image})` }}
                  />
                )}
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold">{event.title}</h2>
                    <p className="text-muted text-sm">{event.venue_name || 'Venue TBA'}</p>
                  </div>
                  <span className="chip">{event.city || 'Ireland'}</span>
                </div>
                <div className="text-sm text-muted">{formatDate(event.start_time)}</div>
                <div className="flex flex-wrap gap-2">
                  {(event.genres || []).slice(0, 3).map((genre) => (
                    <span key={genre} className="chip">{genre}</span>
                  ))}
                  {(event.tags || []).slice(0, 2).map((tag) => (
                    <span key={tag} className="chip">{tag}</span>
                  ))}
                </div>
                <div className="flex flex-wrap gap-3 mt-auto">
                  {event.ticket_url && (
                    <a className="btn btn-outline" href={event.ticket_url} target="_blank" rel="noreferrer">
                      Tickets
                    </a>
                  )}
                  <button
                    className={`btn ${saved ? 'btn-outline' : 'btn-primary'}`}
                    onClick={() => handleSave(event.id)}
                  >
                    {saved ? 'Saved' : 'Save'}
                  </button>
                </div>
                <div className="text-xs text-muted">
                  Sources: {(event.sources || []).map(source => source.source).join(', ') || 'local'}
                </div>
              </motion.article>
            );
          })
        )}
      </section>
    </div>
  );
};

export default CombinedGigs;
