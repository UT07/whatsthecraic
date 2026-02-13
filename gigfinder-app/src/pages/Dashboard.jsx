import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import eventsAPI from '../services/eventsAPI';
import djAPI from '../services/djAPI';
import venueAPI from '../services/venueAPI';
import authAPI from '../services/authAPI';
import { getToken } from '../services/apiClient';

const formatDate = (iso) => {
  if (!iso) return 'TBA';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'TBA';
  return d.toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' });
};

const formatTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' });
};

const GENRE_FILTERS = ['All', 'Electronic', 'Techno', 'House', 'Trad', 'Rock', 'Hip-Hop', 'Jazz', 'Pop', 'Folk'];

const EventCard = ({ event, index, saved, onSave }) => {
  const image = event.images?.[0]?.url;
  return (
    <motion.div
      className="card-event"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
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
            {formatDate(event.start_time)}
          </span>
        </div>
      </div>
      <div className="card-event-body">
        <h3 className="line-clamp-2" style={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.3, marginBottom: '0.35rem' }}>
          {event.title}
        </h3>
        <div className="venue-strip">
          <div className="venue-strip-dot" />
          <span className="venue-strip-name">{event.venue_name || 'Venue TBA'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.6rem' }}>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {(event.genres || []).slice(0, 2).map(g => (
              <span key={g} className="chip" style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem' }}>{g}</span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.35rem' }}>
            {event.ticket_url && (
              <a href={event.ticket_url} target="_blank" rel="noreferrer"
                className="btn btn-sm btn-primary" style={{ fontSize: '0.72rem', padding: '0.3rem 0.65rem' }}>
                Tickets
              </a>
            )}
            <button onClick={() => onSave(event.id)}
              className={`btn btn-sm ${saved ? 'btn-outline' : 'btn-ghost'}`}
              style={{ fontSize: '0.85rem', padding: '0.3rem 0.5rem' }}>
              {saved ? '\u2764\uFE0F' : '\u2661'}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const HeroBanner = ({ event }) => {
  if (!event) return null;
  const image = event.images?.[0]?.url;
  return (
    <Link to="/discover" className="hero-banner" style={{ minHeight: 380 }}>
      {image ? (
        <img src={image} alt={event.title} className="hero-banner-img" />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #1a1a1a, #0a0a0a)' }} />
      )}
      <div className="hero-banner-overlay" />
      <div className="hero-banner-content">
        <span className="badge" style={{ marginBottom: '0.6rem' }}>Featured</span>
        <h2 style={{ fontSize: 'clamp(1.4rem, 3vw, 2.2rem)', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15, marginBottom: '0.5rem' }}>
          {event.title}
        </h2>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', color: 'var(--muted)', fontSize: '0.9rem' }}>
          <span>{event.venue_name || 'Venue TBA'}</span>
          <span style={{ color: 'var(--emerald)' }}>{formatDate(event.start_time)} {formatTime(event.start_time) && `\u00B7 ${formatTime(event.start_time)}`}</span>
        </div>
      </div>
    </Link>
  );
};

const SmallHeroCard = ({ event }) => {
  if (!event) return null;
  const image = event.images?.[0]?.url;
  return (
    <Link to="/discover" className="hero-banner" style={{ minHeight: 180 }}>
      {image ? (
        <img src={image} alt={event.title} className="hero-banner-img" />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #1e1e1e, #111)' }} />
      )}
      <div className="hero-banner-overlay" />
      <div className="hero-banner-content" style={{ padding: '1rem' }}>
        <h3 style={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.25, marginBottom: '0.25rem' }} className="line-clamp-2">
          {event.title}
        </h3>
        <span style={{ fontSize: '0.75rem', color: 'var(--emerald)' }}>{formatDate(event.start_time)}</span>
      </div>
    </Link>
  );
};

const Dashboard = () => {
  const [events, setEvents] = useState([]);
  const [feedEvents, setFeedEvents] = useState([]);
  const [djs, setDjs] = useState([]);
  const [venues, setVenues] = useState([]);
  const [spotifyStatus, setSpotifyStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeGenre, setActiveGenre] = useState('All');
  const [savedIds, setSavedIds] = useState(new Set());

  const token = getToken();
  const authBase = process.env.REACT_APP_AUTH_BASE || 'https://auth.whatsthecraic.run.place';

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const requests = [
          eventsAPI.searchEvents({}),
          djAPI.getAllDJs(),
          venueAPI.getAllVenues()
        ];
        if (token) requests.push(eventsAPI.getFeed({}));

        const results = await Promise.all(requests);
        setEvents(results[0].events || []);
        setDjs(Array.isArray(results[1]) ? results[1] : []);
        setVenues(Array.isArray(results[2]) ? results[2] : []);
        if (results[3]) setFeedEvents(results[3].events || []);
      } catch (error) {
        console.error('Dashboard load error:', error);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    authAPI.getSpotifyStatus()
      .then(setSpotifyStatus)
      .catch(() => setSpotifyStatus(null));
  }, [token]);

  const handleSave = async (id) => {
    try {
      await eventsAPI.saveEvent(id);
      setSavedIds(prev => new Set([...prev, id]));
    } catch (e) { console.error('Save failed:', e); }
  };

  // Prioritize events with images
  const eventsWithImages = events.filter(e => e.images?.[0]?.url);
  const heroEvents = eventsWithImages.length >= 3 ? eventsWithImages : events;

  // Filter events by genre
  const filteredEvents = activeGenre === 'All'
    ? events
    : events.filter(e => (e.genres || []).some(g => g.toLowerCase().includes(activeGenre.toLowerCase())));

  // Personalized or trending
  const personalizedEvents = feedEvents.length > 0 ? feedEvents : events;

  // Upcoming events sorted
  const upcoming = [...events]
    .filter(e => new Date(e.start_time) > new Date())
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton" style={{ height: 380, borderRadius: 18 }} />
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 300, borderRadius: 14 }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {/* ─── HERO GRID ─── */}
      <section className="grid-hero animate-fade-up">
        <HeroBanner event={heroEvents[0]} />
        <SmallHeroCard event={heroEvents[1]} />
        <SmallHeroCard event={heroEvents[2]} />
      </section>

      {/* ─── SPOTIFY CTA ─── */}
      {token && !spotifyStatus?.linked && (
        <motion.section
          className="spotify-cta animate-fade-up"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        >
          <div className="spotify-cta-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381C8.88 5.82 15.78 6.12 20.1 8.82c.54.3.72 1.02.42 1.56-.299.421-1.02.599-1.439.3z" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.2rem' }}>Get personalized picks</h3>
            <p style={{ fontSize: '0.85rem', opacity: 0.85 }}>Connect Spotify to see events matched to your music taste</p>
          </div>
          <a className="btn" href={`${authBase}/auth/spotify/login?token=${token}`}>Connect</a>
        </motion.section>
      )}

      {token && spotifyStatus?.linked && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1.25rem', background: 'rgba(29, 185, 84, 0.08)', borderColor: 'rgba(29, 185, 84, 0.15)' }}>
          <span style={{ color: '#1DB954', fontSize: '1.1rem' }}>&#10003;</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--ink-2)' }}>Spotify connected &middot; {spotifyStatus?.last_synced_at ? `Last synced ${new Date(spotifyStatus.last_synced_at).toLocaleDateString('en-IE')}` : 'Syncing...'}</span>
          <button className="btn btn-sm btn-ghost" style={{ marginLeft: 'auto' }}
            onClick={() => authAPI.syncSpotify().catch(() => {})}>Sync now</button>
        </div>
      )}

      {/* ─── FOR YOU (Personalized) ─── */}
      {token && personalizedEvents.length > 0 && (
        <section>
          <div className="section-header">
            <h2 className="section-header-title">For you</h2>
            <Link to="/discover" className="section-header-link">See all &rarr;</Link>
          </div>
          <div className="scroll-row">
            {personalizedEvents.slice(0, 12).map((event, i) => {
              const img = event.images?.[0]?.url;
              return (
                <div key={event.id || i} className="card-event" style={{ width: 220, flexShrink: 0 }}>
                  <div className="card-event-img-wrap" style={{ paddingTop: '100%' }}>
                    {img ? (
                      <img src={img} alt={event.title} className="card-event-img" loading="lazy" />
                    ) : (
                      <div className="card-event-img-placeholder">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ color: 'var(--muted-2)' }}>
                          <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="card-event-body">
                    <h3 className="line-clamp-2" style={{ fontWeight: 700, fontSize: '0.88rem', lineHeight: 1.3, marginBottom: '0.3rem' }}>{event.title}</h3>
                    <div className="venue-strip">
                      <div className="venue-strip-dot" />
                      <span className="venue-strip-name">{event.venue_name || 'TBA'}</span>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--emerald)', fontWeight: 600, display: 'block', marginTop: '0.3rem' }}>
                      {formatDate(event.start_time)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── QUICK STATS ─── */}
      <section className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        <div className="stat-pill animate-fade-up">
          <div className="stat-pill-icon" style={{ background: 'var(--emerald-dim)', color: 'var(--emerald)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          </div>
          <div>
            <div className="stat-pill-value text-emerald">{events.length}</div>
            <div className="stat-pill-label">Events</div>
          </div>
        </div>
        <div className="stat-pill animate-fade-up">
          <div className="stat-pill-icon" style={{ background: 'var(--gold-dim)', color: 'var(--gold)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          </div>
          <div>
            <div className="stat-pill-value text-gold">{djs.length}</div>
            <div className="stat-pill-label">Artists</div>
          </div>
        </div>
        <div className="stat-pill animate-fade-up">
          <div className="stat-pill-icon" style={{ background: 'var(--sky-dim)', color: 'var(--sky)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>
          </div>
          <div>
            <div className="stat-pill-value text-sky">{venues.length}</div>
            <div className="stat-pill-label">Venues</div>
          </div>
        </div>
      </section>

      {/* ─── BROWSE BY GENRE ─── */}
      <section>
        <div className="section-header">
          <h2 className="section-header-title">Browse events</h2>
          <Link to="/discover" className="section-header-link">All events &rarr;</Link>
        </div>
        <div className="filter-row" style={{ marginBottom: '1.25rem' }}>
          {GENRE_FILTERS.map(g => (
            <button
              key={g}
              className={`filter-chip ${activeGenre === g ? 'filter-chip-active' : ''}`}
              onClick={() => setActiveGenre(g)}
            >
              {g}
            </button>
          ))}
        </div>
        <div className="grid-events">
          {filteredEvents.slice(0, 12).map((event, i) => (
            <EventCard key={event.id || i} event={event} index={i} saved={savedIds.has(event.id)} onSave={handleSave} />
          ))}
        </div>
        {filteredEvents.length === 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <p style={{ color: 'var(--muted)', fontSize: '0.95rem' }}>No {activeGenre} events found. Try a different genre.</p>
          </div>
        )}
      </section>

      {/* ─── UPCOMING THIS WEEK ─── */}
      {upcoming.length > 0 && (
        <section>
          <div className="section-header">
            <h2 className="section-header-title">Coming up</h2>
          </div>
          <div className="scroll-row">
            {upcoming.slice(0, 10).map((event, i) => {
              const img = event.images?.[0]?.url;
              return (
                <div key={event.id || i} style={{ width: 300, flexShrink: 0 }} className="card" >
                  <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                    <div style={{
                      width: 72, height: 72, borderRadius: 10, overflow: 'hidden',
                      flexShrink: 0, background: 'var(--bg-3)'
                    }}>
                      {img ? (
                        <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted-2)' }}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
                        </div>
                      )}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h4 className="line-clamp-2" style={{ fontWeight: 700, fontSize: '0.9rem', lineHeight: 1.3, marginBottom: '0.25rem' }}>{event.title}</h4>
                      <p style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.15rem' }}>{event.venue_name || 'TBA'}</p>
                      <span style={{ fontSize: '0.75rem', color: 'var(--emerald)', fontWeight: 600 }}>{formatDate(event.start_time)} {formatTime(event.start_time) && `\u00B7 ${formatTime(event.start_time)}`}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── VENUES TO EXPLORE ─── */}
      <section>
        <div className="section-header">
          <h2 className="section-header-title">Popular venues</h2>
          <Link to="/venues" className="section-header-link">All venues &rarr;</Link>
        </div>
        <div className="scroll-row">
          {venues.slice(0, 8).map((venue) => (
            <Link to="/venues" key={venue.id} className="card-venue" style={{ width: 260, flexShrink: 0 }}>
              <div className="card-venue-img-wrap">
                <div style={{
                  position: 'absolute', inset: 0,
                  background: `linear-gradient(135deg, hsl(${(venue.id * 47) % 360}, 30%, 15%), hsl(${(venue.id * 83) % 360}, 20%, 10%))`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--muted-2)' }}>
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9,22 9,12 15,12 15,22" />
                  </svg>
                </div>
              </div>
              <div className="card-venue-body">
                <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.2rem' }} className="line-clamp-1">{venue.name}</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--muted)' }} className="line-clamp-1">{venue.address || 'Dublin, Ireland'}</p>
                <div style={{ display: 'flex', gap: '0.35rem', marginTop: '0.4rem' }}>
                  {venue.genreFocus && <span className="chip" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem' }}>{venue.genreFocus}</span>}
                  {venue.capacity && <span className="chip" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem' }}>{venue.capacity} cap</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ─── LOCAL IRISH DJs ─── */}
      <section>
        <div className="section-header">
          <h2 className="section-header-title">Local Irish selection</h2>
          <Link to="/djs" className="section-header-link">See all &rarr;</Link>
        </div>
        <div className="scroll-row">
          {djs.slice(0, 10).map((dj) => (
            <Link to="/djs" key={dj.dj_id} className="card-artist" style={{ width: 180, flexShrink: 0 }}>
              <div className="card-artist-img-wrap">
                <div style={{
                  position: 'absolute', inset: 0,
                  background: `linear-gradient(135deg, hsl(${(dj.dj_id * 67) % 360}, 40%, 18%), hsl(${(dj.dj_id * 31) % 360}, 25%, 12%))`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <span style={{ fontSize: '2rem', fontWeight: 800, color: 'rgba(255,255,255,0.15)' }}>
                    {(dj.dj_name || '?')[0].toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="card-artist-body">
                <h3 className="line-clamp-1" style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.15rem' }}>{dj.dj_name}</h3>
                <p className="line-clamp-1" style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{dj.genres || 'Various'}</p>
                <span style={{ fontSize: '0.68rem', color: 'var(--emerald)' }}>{dj.city || 'Ireland'}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ─── BOTTOM CTA ─── */}
      <section className="card" style={{ textAlign: 'center', padding: '3rem 2rem', background: 'linear-gradient(135deg, rgba(0,214,125,0.06) 0%, rgba(0,0,0,0) 100%)', borderColor: 'rgba(0,214,125,0.12)' }}>
        <h3 style={{ fontWeight: 800, fontSize: '1.3rem', letterSpacing: '-0.02em', marginBottom: '0.5rem' }}>
          Discover what's on tonight
        </h3>
        <p style={{ color: 'var(--muted)', marginBottom: '1.25rem', fontSize: '0.9rem' }}>
          Browse events across Ireland, filtered by your taste
        </p>
        <Link to="/discover" className="btn btn-primary btn-lg">
          Explore events
        </Link>
      </section>
    </div>
  );
};

export default Dashboard;
