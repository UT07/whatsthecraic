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
  const [alerts, setAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertForm, setAlertForm] = useState({ artist_name: '', city: '' });
  const [alertResults, setAlertResults] = useState([]);
  const [hiddenEvents, setHiddenEvents] = useState([]);
  const [savedEvents, setSavedEvents] = useState([]);

  const [filters, setFilters] = useState({
    city: '',
    from: '',
    to: '',
    genres: '',
    q: '',
    artist: '',
    venue: '',
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

  useEffect(() => {
    if (!token) return;
    eventsAPI.getAlerts()
      .then((data) => setAlerts(data.alerts || []))
      .catch(() => setAlerts([]));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    eventsAPI.getHiddenEvents()
      .then((data) => setHiddenEvents(data.events || []))
      .catch(() => setHiddenEvents([]));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    eventsAPI.getSavedEvents()
      .then((data) => setSavedEvents(data.events || []))
      .catch(() => setSavedEvents([]));
  }, [token]);

  const handleSave = async (id) => {
    try {
      await eventsAPI.saveEvent(id);
      setSavedIds(prev => new Set([...prev, id]));
      const savedEvent = events.find(item => item.id === id);
      if (savedEvent) {
        setSavedEvents(prev => [savedEvent, ...prev.filter(item => item.id !== id)]);
      }
    } catch (error) {
      console.error('Save failed:', error);
    }
  };

  const handleHide = async (event) => {
    try {
      await eventsAPI.hideEvent(event.id);
      setEvents(prev => prev.filter(item => item.id !== event.id));
      setHiddenEvents(prev => [event, ...prev]);
    } catch (error) {
      console.error('Hide failed:', error);
    }
  };

  const handleUnhide = async (eventId) => {
    try {
      await eventsAPI.unhideEvent(eventId);
      setHiddenEvents(prev => prev.filter(event => event.id !== eventId));
    } catch (error) {
      console.error('Unhide failed:', error);
    }
  };

  const createAlert = async () => {
    if (!alertForm.artist_name.trim()) return;
    try {
      setAlertsLoading(true);
      const response = await eventsAPI.createAlert(alertForm);
      setAlerts(prev => [response.alert, ...prev]);
      setAlertForm({ artist_name: '', city: '' });
    } catch (error) {
      console.error('Alert create failed:', error);
    } finally {
      setAlertsLoading(false);
    }
  };

  const deleteAlert = async (id) => {
    try {
      await eventsAPI.deleteAlert(id);
      setAlerts(prev => prev.filter(alert => alert.id !== id));
    } catch (error) {
      console.error('Alert delete failed:', error);
    }
  };

  const checkAlerts = async () => {
    try {
      setAlertsLoading(true);
      const data = await eventsAPI.checkAlertNotifications();
      setAlertResults(data.alerts || []);
    } catch (error) {
      console.error('Alert check failed:', error);
    } finally {
      setAlertsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <section>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-8">
          <div>
            <div className="badge mb-3">Discover Events</div>
            <h1 className="section-title mb-2">Find your next night out</h1>
            <p className="section-subtitle">
              Explore events across Ireland or use filters for a targeted search.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {token && (
              <a
                className="btn btn-outline"
                href={eventsAPI.getUserCalendarUrl(token)}
                target="_blank"
                rel="noreferrer"
              >
                📅 Export Calendar
              </a>
            )}
            <button
              className={`btn ${mode === 'feed' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setMode('feed')}
              disabled={!token}
              title={!token ? 'Sign in to use For You' : ''}
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

        {/* Search Filters Card */}
        <div className="card space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <input
            className="input"
            placeholder="Search keyword"
            value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
          />
          <input
            className="input"
            placeholder="City (ex: Dublin)"
            value={filters.city}
            onChange={(e) => setFilters({ ...filters, city: e.target.value })}
          />
          <input
            className="input"
            placeholder="Artist (ex: Fontaines D.C.)"
            value={filters.artist}
            onChange={(e) => setFilters({ ...filters, artist: e.target.value })}
          />
          <input
            className="input"
            placeholder="Genres (comma separated)"
            value={filters.genres}
            onChange={(e) => setFilters({ ...filters, genres: e.target.value })}
          />
          <input
            className="input"
            placeholder="Venue name"
            value={filters.venue}
            onChange={(e) => setFilters({ ...filters, venue: e.target.value })}
          />
          <select
            className="input"
            value={filters.source}
            onChange={(e) => setFilters({ ...filters, source: e.target.value })}
          >
            <option value="">All ticket sources</option>
            <option value="ticketmaster">Ticketmaster</option>
            <option value="eventbrite">Eventbrite</option>
            <option value="bandsintown">Bandsintown</option>
            <option value="dice">Dice.fm</option>
            <option value="local">Local listings</option>
          </select>
          <input
            className="input"
            type="date"
            placeholder="From date"
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          />
          <input
            className="input"
            type="date"
            placeholder="To date"
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

          <div className="flex flex-wrap gap-3 pt-2">
            <button className="btn btn-primary flex-1 sm:flex-none" onClick={mode === 'feed' ? loadFeed : runSearch}>
              {mode === 'feed' ? '🔄 Refresh Feed' : '🔍 Search'}
            </button>
            <button
              className="btn btn-outline"
              onClick={() => setFilters({
                city: '',
                from: '',
                to: '',
                genres: '',
                q: '',
                artist: '',
                venue: '',
                priceMax: '',
                source: ''
              })}
            >
              Clear all
            </button>
            {!token && <span className="chip">Sign in to unlock personalized feed</span>}
          </div>
        </div>
      </section>

      {token && (
        <section className="card space-y-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="badge mb-2">Alerts</div>
              <h2 className="text-lg font-bold mb-1">Artist alerts</h2>
              <p className="text-muted text-sm">Get notified when your favorite artists announce new events.</p>
            </div>
            <button className="btn btn-outline" onClick={checkAlerts} disabled={alertsLoading}>
              {alertsLoading ? '⏳ Checking…' : '🔔 Check alerts'}
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <input
              className="input"
              placeholder="Artist name"
              value={alertForm.artist_name}
              onChange={(e) => setAlertForm({ ...alertForm, artist_name: e.target.value })}
            />
            <input
              className="input"
              placeholder="City (optional)"
              value={alertForm.city}
              onChange={(e) => setAlertForm({ ...alertForm, city: e.target.value })}
            />
            <button className="btn btn-primary" onClick={createAlert} disabled={alertsLoading}>
              Add alert
            </button>
          </div>
          <div className="grid-auto">
            {alerts.length === 0 ? (
              <div className="card text-center text-muted">No alerts yet.</div>
            ) : (
              alerts.map(alert => (
                <div key={alert.id} className="card flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">{alert.artist_name}</div>
                    <div className="text-muted text-xs">{alert.city || 'Any city'}</div>
                  </div>
                  <button className="btn btn-ghost" onClick={() => deleteAlert(alert.id)}>Remove</button>
                </div>
              ))
            )}
          </div>
          {alertResults.length > 0 && (
            <div className="space-y-3">
              <h3 className="section-title text-base">New matches</h3>
              {alertResults.map(result => (
                <div key={result.alert.id} className="card">
                  <div className="text-sm font-semibold">{result.alert.artist_name}</div>
                  <div className="text-muted text-xs mb-3">{result.alert.city || 'Any city'}</div>
                  {result.events.length === 0 ? (
                    <div className="text-muted text-sm">No new events.</div>
                  ) : (
                    <ul className="text-sm space-y-1">
                      {result.events.map(evt => (
                        <li key={evt.id}>{evt.title} · {formatDate(evt.start_time)}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {token && (
        <section className="card space-y-4">
          <div>
            <div className="badge mb-2">Saved</div>
            <h2 className="text-lg font-bold mb-1">Saved events</h2>
            <p className="text-muted text-sm">Your shortlist of events to revisit later.</p>
          </div>
          {savedEvents.length === 0 ? (
            <div className="text-muted text-sm">No saved events yet.</div>
          ) : (
            <div className="grid gap-2">
              {savedEvents.map(event => (
                <div key={event.id} className="card flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">{event.title}</div>
                    <div className="text-xs text-muted">{formatDate(event.start_time)}</div>
                  </div>
                  <a
                    className="btn btn-ghost"
                    href={eventsAPI.getEventCalendarUrl(event.id)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Calendar
                  </a>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {token && (
        <section className="card space-y-4">
          <div>
            <div className="badge mb-2">Hidden</div>
            <h2 className="text-lg font-bold mb-1">Hidden events</h2>
            <p className="text-muted text-sm">Easily restore events you dismissed from your feed.</p>
          </div>
          {hiddenEvents.length === 0 ? (
            <div className="text-muted text-sm">No hidden events yet.</div>
          ) : (
            <div className="grid gap-2">
              {hiddenEvents.map(event => (
                <div key={event.id} className="card flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">{event.title}</div>
                    <div className="text-xs text-muted">{formatDate(event.start_time)}</div>
                  </div>
                  <button className="btn btn-ghost" onClick={() => handleUnhide(event.id)}>
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section>
        {loading ? (
          <div className="flex items-center justify-center min-h-96">
            <div className="text-center">
              <div className="inline-block w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-muted">Loading events…</p>
            </div>
          </div>
        ) : events.length === 0 ? (
          <div className="card text-center py-16">
            <p className="text-2xl mb-2">🎭</p>
            <p className="text-lg font-semibold mb-2">No events found</p>
            <p className="text-muted">Try adjusting your filters or search criteria.</p>
          </div>
        ) : (
          <div className="grid-auto">
            {events.map((event, index) => {
              const image = event.images?.[0]?.url;
              const saved = savedIds.has(event.id);
              return (
                <motion.article
                  key={`${event.id}-${index}`}
                  className="card overflow-hidden flex flex-col h-full hover:scale-105 transition-transform duration-200"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: index * 0.03 }}
                >
                  {/* Event Image */}
                  {image && (
                    <div
                      className="w-full h-48 bg-cover bg-center -m-6 mb-4"
                      style={{ backgroundImage: `url(${image})` }}
                    />
                  )}
                  {!image && (
                    <div className="w-full h-48 bg-gradient-to-br from-accent/10 to-accent-3/10 flex items-center justify-center -m-6 mb-4">
                      <span className="text-4xl">🎵</span>
                    </div>
                  )}

                  {/* Event Details */}
                  <div className="flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <h2 className="text-lg font-bold leading-snug flex-1">{event.title}</h2>
                      <span className="chip whitespace-nowrap">{event.city || 'Ireland'}</span>
                    </div>

                    <p className="text-muted text-sm font-medium mb-3">{event.venue_name || 'Venue TBA'}</p>

                    {/* Date & Time */}
                    <div className="flex items-center gap-2 text-sm font-medium text-accent mb-3">
                      <span>📅</span>
                      <span>{formatDate(event.start_time)}</span>
                    </div>

                    {/* Genres */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {(event.genres || []).slice(0, 2).map((genre) => (
                        <span key={genre} className="chip">{genre}</span>
                      ))}
                      {(event.tags || []).slice(0, 1).map((tag) => (
                        <span key={tag} className="chip">{tag}</span>
                      ))}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-2 mt-auto pt-4 border-t border-line">
                      <button
                        className={`btn w-full ${saved ? 'btn-outline' : 'btn-primary'}`}
                        onClick={() => handleSave(event.id)}
                      >
                        {saved ? '❤️ Saved' : '🤍 Save'}
                      </button>
                      <div className="flex gap-2">
                        {event.ticket_url && (
                          <a
                            className="btn btn-outline flex-1 text-sm"
                            href={event.ticket_url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            🎫 Tickets
                          </a>
                        )}
                        <a
                          className="btn btn-outline flex-1 text-sm"
                          href={eventsAPI.getEventCalendarUrl(event.id)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          📅 Calendar
                        </a>
                      </div>
                      {token && (
                        <button
                          className="btn btn-ghost text-sm"
                          onClick={() => handleHide(event)}
                        >
                          👁️ Hide this
                        </button>
                      )}
                    </div>

                    {/* Source */}
                    <p className="text-xs text-muted mt-3 pt-3 border-t border-line/50">
                      {(event.sources || []).map(source => source.source).join(', ') || 'local'}
                    </p>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default CombinedGigs;
