import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import eventsAPI from '../services/eventsAPI';
import { getToken } from '../services/apiClient';
import { getBestImage, fetchArtistImage } from '../utils/imageUtils';

const formatDate = (iso) => {
  if (!iso) return 'TBA';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'TBA';
  return date.toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' });
};

const formatTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' });
};

/* ─── MATCH REASON BADGE ─── */
const MatchBadge = ({ reasons, score }) => {
  if (!reasons && !score) return null;
  const reasonList = typeof reasons === 'string' ? reasons.split(',').map(r => r.trim()) : (reasons || []);
  const topReason = reasonList[0];
  if (!topReason && !score) return null;

  const label = topReason === 'genre_match' ? 'Genre match'
    : topReason === 'artist_match' ? 'Artist you follow'
    : topReason === 'venue_match' ? 'Favourite venue'
    : topReason === 'city_match' ? 'Your city'
    : topReason === 'collaborative' ? 'Fans like you'
    : topReason === 'popularity' ? 'Trending'
    : score > 0.7 ? 'Top pick'
    : score > 0.4 ? 'Good match'
    : null;

  if (!label) return null;

  const color = topReason === 'genre_match' ? 'var(--violet)'
    : topReason === 'artist_match' ? '#1DB954'
    : topReason === 'collaborative' ? 'var(--sky)'
    : 'var(--emerald)';

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
      padding: '0.2rem 0.55rem', borderRadius: 6,
      background: `${color}18`, color,
      fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.5px', marginBottom: '0.3rem'
    }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14 2 9.27l6.91-1.01z"/></svg>
      {label}
    </span>
  );
};

const EventCard = ({ event, index, saved, onSave, onHide, token }) => {
  const [image, setImage] = useState(getBestImage(event.images, 'card', 400));
  const [loadingImage, setLoadingImage] = useState(false);

  // Fetch artist image if event has no image
  useEffect(() => {
    const loadArtistImage = async () => {
      if (!image && event.title && !loadingImage) {
        setLoadingImage(true);
        // Extract artist name from event title (usually first part before @ or - or at)
        const artistName = event.title.split(/[@\-–]|at\s/i)[0].trim();
        const artistImage = await fetchArtistImage(artistName);
        if (artistImage) {
          setImage(artistImage);
        }
        setLoadingImage(false);
      }
    };
    loadArtistImage();
  }, [event.title, image, loadingImage]);

  return (
    <motion.article
      className="card-event"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.03 }}
    >
      <div className="card-event-img-wrap">
        {image ? (
          <img src={image} alt={event.title} className="card-event-img" loading="lazy" />
        ) : (
          <div className="card-event-img-placeholder">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ color: 'var(--muted-2)' }}>
              <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
            </svg>
          </div>
        )}
        <div className="card-event-overlay">
          <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--emerald)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {formatDate(event.start_time)} {formatTime(event.start_time) && `\u00B7 ${formatTime(event.start_time)}`}
          </span>
        </div>
        {/* Match score badge on image */}
        {event.rank_score > 0 && (
          <div style={{
            position: 'absolute', top: 10, left: 10, zIndex: 3,
            padding: '0.2rem 0.5rem', borderRadius: 6,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
            color: event.rank_score > 0.7 ? 'var(--emerald)' : event.rank_score > 0.4 ? 'var(--gold)' : 'var(--muted)',
            fontSize: '0.65rem', fontWeight: 800
          }}>
            {Math.round(event.rank_score * 100)}% match
          </div>
        )}
        {token && (
          <button
            onClick={(e) => { e.stopPropagation(); onSave(event.id); }}
            style={{
              position: 'absolute', top: 10, right: 10, zIndex: 3,
              width: 34, height: 34, borderRadius: 9,
              background: saved ? 'var(--emerald)' : 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(8px)', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: saved ? '#000' : '#fff', fontSize: '0.95rem',
              transition: 'all 0.2s ease'
            }}
          >
            {saved ? '\u2764\uFE0F' : '\u2661'}
          </button>
        )}
      </div>
      <div className="card-event-body">
        <MatchBadge reasons={event.rank_reasons} score={event.rank_score} />
        <h3 className="line-clamp-2" style={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.3, marginBottom: '0.35rem' }}>
          {event.title}
        </h3>
        <div className="venue-strip">
          <div className="venue-strip-dot" />
          <span className="venue-strip-name">{event.venue_name || 'Venue TBA'}</span>
        </div>
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', margin: '0.5rem 0' }}>
          {(event.genres || []).slice(0, 2).map(g => (
            <span key={g} className="chip" style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem' }}>{g}</span>
          ))}
          <span className="chip" style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem' }}>
            {event.city || 'Ireland'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.5rem' }}>
          {event.ticket_url && (
            <a href={event.ticket_url} target="_blank" rel="noreferrer"
              className="btn btn-primary btn-sm" style={{ flex: 1, fontSize: '0.78rem' }}>
              Tickets
            </a>
          )}
          <a href={eventsAPI.getEventCalendarUrl(event.id)} target="_blank" rel="noreferrer"
            className="btn btn-outline btn-sm" style={{ fontSize: '0.78rem' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </a>
          {token && onHide && (
            <button onClick={() => onHide(event)} className="btn btn-ghost btn-sm" style={{ fontSize: '0.78rem' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
            </button>
          )}
        </div>
        <p style={{ fontSize: '0.68rem', color: 'var(--muted-2)', marginTop: '0.5rem' }}>
          {(event.sources || []).map(s => s.source).join(' \u00B7 ') || 'local'}
        </p>
      </div>
    </motion.article>
  );
};

const CombinedGigs = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const token = getToken();
  const [mode, setMode] = useState(token ? 'feed' : 'search');
  const [savedIds, setSavedIds] = useState(new Set());
  const [alerts, setAlerts] = useState([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [alertForm, setAlertForm] = useState({ artist_name: '', city: '' });
  const [alertResults, setAlertResults] = useState([]);
  const [hiddenEvents, setHiddenEvents] = useState([]);
  const [savedEvents, setSavedEvents] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState('events');
  const [resultInfo, setResultInfo] = useState({ ranked: false, count: 0 });

  const [filters, setFilters] = useState({
    city: '', from: '', to: '', genres: '', q: '',
    artist: '', venue: '', priceMax: '', source: '', limit: '200'
  });

  const activeFilters = useMemo(() => {
    const clean = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) clean[k] = v; });
    return clean;
  }, [filters]);

  const loadFeed = async () => {
    setLoading(true);
    try {
      const data = await eventsAPI.getFeed(activeFilters);
      setEvents(data.events || []);
      setResultInfo({ ranked: data.ranked || false, count: data.count || 0 });
    } catch { setEvents([]); }
    finally { setLoading(false); }
  };

  const runSearch = async () => {
    setLoading(true);
    try {
      const data = await eventsAPI.searchEvents(activeFilters);
      setEvents(data.events || []);
      setResultInfo({ ranked: data.ranked || false, count: data.count || 0 });
    } catch { setEvents([]); }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (mode === 'feed') loadFeed();
    else if (mode === 'search') runSearch();
  }, [mode]);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      eventsAPI.getAlerts().catch(() => ({ alerts: [] })),
      eventsAPI.getHiddenEvents().catch(() => ({ events: [] })),
      eventsAPI.getSavedEvents().catch(() => ({ events: [] }))
    ]).then(([a, h, s]) => {
      setAlerts(a.alerts || []);
      setHiddenEvents(h.events || []);
      setSavedEvents(s.events || []);
    });
  }, [token]);

  const handleSave = async (id) => {
    try {
      await eventsAPI.saveEvent(id);
      setSavedIds(prev => new Set([...prev, id]));
      const ev = events.find(e => e.id === id);
      if (ev) setSavedEvents(prev => [ev, ...prev.filter(e => e.id !== id)]);
    } catch (e) { console.error('Save failed:', e); }
  };

  const handleHide = async (event) => {
    try {
      await eventsAPI.hideEvent(event.id);
      setEvents(prev => prev.filter(e => e.id !== event.id));
      setHiddenEvents(prev => [event, ...prev]);
    } catch (e) { console.error('Hide failed:', e); }
  };

  const handleUnhide = async (id) => {
    try {
      await eventsAPI.unhideEvent(id);
      setHiddenEvents(prev => prev.filter(e => e.id !== id));
    } catch (e) { console.error('Unhide failed:', e); }
  };

  const createAlert = async () => {
    if (!alertForm.artist_name.trim()) return;
    try {
      setAlertsLoading(true);
      const res = await eventsAPI.createAlert(alertForm);
      setAlerts(prev => [res.alert, ...prev]);
      setAlertForm({ artist_name: '', city: '' });
    } catch {} finally { setAlertsLoading(false); }
  };

  const deleteAlert = async (id) => {
    try {
      await eventsAPI.deleteAlert(id);
      setAlerts(prev => prev.filter(a => a.id !== id));
    } catch {}
  };

  const checkAlerts = async () => {
    try {
      setAlertsLoading(true);
      const data = await eventsAPI.checkAlertNotifications();
      setAlertResults(data.alerts || []);
    } catch {} finally { setAlertsLoading(false); }
  };

  const clearFilters = () => setFilters({ city: '', from: '', to: '', genres: '', q: '', artist: '', venue: '', priceMax: '', source: '' });

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <section>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div>
            <h1 className="section-title" style={{ marginBottom: '0.3rem' }}>Discover</h1>
            <p className="section-subtitle">Find events across Ireland, personalized to your taste</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            {token && (
              <a className="btn btn-outline btn-sm" href={eventsAPI.getUserCalendarUrl(token)} target="_blank" rel="noreferrer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                Export
              </a>
            )}
            <div className="tabs">
              <button className={`tab ${mode === 'feed' ? 'tab-active' : ''}`}
                onClick={() => setMode('feed')} disabled={!token}
                title={!token ? 'Sign in for personalized feed' : ''}>
                For You
              </button>
              <button className={`tab ${mode === 'search' ? 'tab-active' : ''}`}
                onClick={() => setMode('search')}>
                Search
              </button>
            </div>
          </div>
        </div>

        {/* Search bar */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-2)' }}>
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input className="input" placeholder="Search events, artists, venues..."
              value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })}
              style={{ paddingLeft: '2.5rem' }}
              onKeyDown={(e) => e.key === 'Enter' && (mode === 'feed' ? loadFeed() : runSearch())}
            />
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => setShowFilters(!showFilters)}
            style={{ position: 'relative' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/></svg>
            Filters
            {activeFilterCount > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4,
                width: 18, height: 18, borderRadius: 9,
                background: 'var(--emerald)', color: '#000',
                fontSize: '0.6rem', fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {activeFilterCount}
              </span>
            )}
          </button>
          <button className="btn btn-primary btn-sm" onClick={mode === 'feed' ? loadFeed : runSearch}>
            Search
          </button>
        </div>

        {/* Expanded filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div className="card"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ marginBottom: '1rem', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                <input className="input" placeholder="City" value={filters.city} onChange={(e) => setFilters({ ...filters, city: e.target.value })} />
                <input className="input" placeholder="Artist" value={filters.artist} onChange={(e) => setFilters({ ...filters, artist: e.target.value })} />
                <input className="input" placeholder="Genres" value={filters.genres} onChange={(e) => setFilters({ ...filters, genres: e.target.value })} />
                <input className="input" placeholder="Venue" value={filters.venue} onChange={(e) => setFilters({ ...filters, venue: e.target.value })} />
                <select className="input" value={filters.source} onChange={(e) => setFilters({ ...filters, source: e.target.value })}>
                  <option value="">All sources</option>
                  <option value="ticketmaster">Ticketmaster</option>
                  <option value="eventbrite">Eventbrite</option>
                  <option value="bandsintown">Bandsintown</option>
                  <option value="dice">Dice.fm</option>
                  <option value="local">Local</option>
                </select>
                <input className="input" type="number" placeholder="Max price (EUR)" value={filters.priceMax} onChange={(e) => setFilters({ ...filters, priceMax: e.target.value })} />
                <input className="input" type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} />
                <input className="input" type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', alignItems: 'center' }}>
                <button className="btn btn-ghost btn-sm" onClick={clearFilters}>Clear all</button>
                {!token && <span className="chip">Sign in for personalized feed</span>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results summary */}
        {!loading && events.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>
              {resultInfo.count || events.length} events
            </span>
            {resultInfo.ranked && (
              <span className="badge" style={{ fontSize: '0.6rem' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14 2 9.27l6.91-1.01z"/></svg>
                Personalized
              </span>
            )}
            {mode === 'feed' && token && (
              <span style={{ fontSize: '0.72rem', color: 'var(--muted-2)' }}>
                Ranked by your preferences
              </span>
            )}
          </div>
        )}
      </section>

      {/* Tabs for sub-sections */}
      {token && (
        <div className="tabs" style={{ width: 'fit-content' }}>
          <button className={`tab ${activeTab === 'events' ? 'tab-active' : ''}`} onClick={() => setActiveTab('events')}>Events</button>
          <button className={`tab ${activeTab === 'saved' ? 'tab-active' : ''}`} onClick={() => setActiveTab('saved')}>
            Saved {savedEvents.length > 0 && `(${savedEvents.length})`}
          </button>
          <button className={`tab ${activeTab === 'alerts' ? 'tab-active' : ''}`} onClick={() => setActiveTab('alerts')}>Alerts</button>
          <button className={`tab ${activeTab === 'hidden' ? 'tab-active' : ''}`} onClick={() => setActiveTab('hidden')}>Hidden</button>
        </div>
      )}

      {/* Alerts Tab */}
      {token && activeTab === 'alerts' && (
        <section className="card space-y-4 animate-fade-in">
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
            <div>
              <h2 style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '0.2rem' }}>Artist alerts</h2>
              <p style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>Get notified when favourite artists announce events</p>
            </div>
            <button className="btn btn-outline btn-sm" onClick={checkAlerts} disabled={alertsLoading}>
              {alertsLoading ? 'Checking...' : 'Check alerts'}
            </button>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input className="input" placeholder="Artist name" value={alertForm.artist_name}
              onChange={(e) => setAlertForm({ ...alertForm, artist_name: e.target.value })} style={{ flex: 1 }} />
            <input className="input" placeholder="City (optional)" value={alertForm.city}
              onChange={(e) => setAlertForm({ ...alertForm, city: e.target.value })} style={{ width: 160 }} />
            <button className="btn btn-primary btn-sm" onClick={createAlert} disabled={alertsLoading}>Add</button>
          </div>
          {alerts.length === 0 ? (
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1.5rem' }}>No alerts yet</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {alerts.map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid var(--line)' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{a.artist_name}</span>
                  {a.city && <span className="chip" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem' }}>{a.city}</span>}
                  <button onClick={() => deleteAlert(a.id)} className="btn btn-ghost" style={{ padding: '0.2rem', fontSize: '0.8rem', color: 'var(--muted)' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          {alertResults.length > 0 && (
            <div className="space-y-3">
              <h3 style={{ fontWeight: 700, fontSize: '0.95rem' }}>New matches</h3>
              {alertResults.map(r => (
                <div key={r.alert.id} className="card">
                  <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{r.alert.artist_name}</span>
                  {r.events.length === 0 ? (
                    <p style={{ color: 'var(--muted)', fontSize: '0.82rem', marginTop: '0.3rem' }}>No new events</p>
                  ) : (
                    <div style={{ marginTop: '0.4rem' }}>
                      {r.events.map(evt => (
                        <div key={evt.id} style={{ fontSize: '0.82rem', padding: '0.25rem 0', color: 'var(--ink-2)' }}>
                          {evt.title} <span style={{ color: 'var(--emerald)' }}>&middot; {formatDate(evt.start_time)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Saved Tab */}
      {token && activeTab === 'saved' && (
        <section className="animate-fade-in">
          {savedEvents.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ color: 'var(--muted-2)', margin: '0 auto 1rem' }}>
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
              </svg>
              <p style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '0.3rem' }}>No saved events yet</p>
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>Save events with the heart button to find them here later</p>
            </div>
          ) : (
            <div className="grid-events">
              {savedEvents.map((event, i) => (
                <EventCard key={event.id} event={event} index={i} saved={true} onSave={handleSave} token={token} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Hidden Tab */}
      {token && activeTab === 'hidden' && (
        <section className="animate-fade-in">
          {hiddenEvents.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <p style={{ color: 'var(--muted)' }}>No hidden events.</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {hiddenEvents.map(event => (
                <div key={event.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.85rem 1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {event.images?.length > 0 && (
                      <img src={getBestImage(event.images, 'thumb', 80)} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
                    )}
                    <div>
                      <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{event.title}</span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--muted)', marginLeft: '0.75rem' }}>{formatDate(event.start_time)}</span>
                    </div>
                  </div>
                  <button className="btn btn-outline btn-sm" onClick={() => handleUnhide(event.id)}>Restore</button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Events Grid */}
      {activeTab === 'events' && (
        <section>
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="skeleton" style={{ height: 320, borderRadius: 14 }} />
                ))}
              </motion.div>
            ) : events.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ color: 'var(--muted-2)', margin: '0 auto 1rem' }}>
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <p style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.35rem' }}>No events found</p>
                <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>Try adjusting your filters or search terms</p>
              </motion.div>
            ) : (
              <motion.div
                key="events"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid-events">
                {events.map((event, i) => (
                  <EventCard key={`${event.id}-${i}`} event={event} index={i}
                    saved={savedIds.has(event.id)} onSave={handleSave} onHide={handleHide} token={token} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}
    </div>
  );
};

export default CombinedGigs;
