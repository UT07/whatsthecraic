import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import eventsAPI from '../services/eventsAPI';
import djAPI from '../services/djAPI';
import venueAPI from '../services/venueAPI';
import authAPI from '../services/authAPI';
import mlAPI from '../services/mlAPI';
import { getToken } from '../services/apiClient';
import { getBestImage, fetchArtistImage } from '../utils/imageUtils';
import { ExplainabilityModal, TasteProfilePanel, FeedbackButtons, EventDensityHeatMap } from '../components/ml';

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

const GENRE_FILTERS = ['All', 'Electronic', 'Techno', 'House', 'Trad', 'Rock', 'Hip-Hop', 'Jazz', 'Pop', 'Folk', 'Comedy'];

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
      letterSpacing: '0.5px'
    }}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14 2 9.27l6.91-1.01z"/></svg>
      {label}
    </span>
  );
};

const EventCard = ({ event, index, saved, onSave, onExplain, onCardClick, showFeedback = false }) => {
  const image = getBestImage(event.images, 'card', 400);

  const handleCardClick = () => {
    if (onCardClick) {
      onCardClick(event);
    }
  };

  return (
    <motion.div
      className="card-event"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
    >
      <div className="card-event-img-wrap" onClick={handleCardClick} style={{ cursor: onCardClick ? 'pointer' : 'default' }}>
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
        {/* ML match reason */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
          <MatchBadge reasons={event.rank_reasons} score={event.rank_score} />
          {onExplain && (event.rank_reasons || event.rank_score) && (
            <button
              onClick={() => onExplain(event)}
              className="btn btn-ghost"
              style={{
                fontSize: '0.65rem',
                padding: '0.2rem 0.5rem',
                minWidth: 'auto',
                opacity: 0.7
              }}
              title="Why this event?"
            >
              ?
            </button>
          )}
        </div>
        <h3 className="line-clamp-2" style={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.3, marginBottom: '0.35rem', marginTop: event.rank_reasons || event.rank_score ? '0.35rem' : 0 }}>
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
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            {showFeedback && (
              <FeedbackButtons
                eventId={event.id}
                size="sm"
                context={{ page: 'dashboard', position: index }}
              />
            )}
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
  const image = getBestImage(event.images, 'hero', 1200);
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
  const image = getBestImage(event.images, 'card', 600);
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

/* Enhanced Upcoming Event Card with image loading */
const UpcomingEventCard = ({ event, index }) => {
  const [image, setImage] = useState(getBestImage(event.images, 'thumb', 200));
  const [loadingImage, setLoadingImage] = useState(false);

  useEffect(() => {
    const loadArtistImage = async () => {
      if (!image && event.title && !loadingImage) {
        setLoadingImage(true);
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
    <div key={event.id || index} style={{ width: 300, flexShrink: 0 }} className="card">
      <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
        <div style={{
          width: 72, height: 72, borderRadius: 10, overflow: 'hidden',
          flexShrink: 0, background: 'var(--bg-3)', position: 'relative'
        }}>
          {image ? (
            <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
};

/* ─── SPOTIFY PROFILE WIDGET ─── */
const SpotifyProfileWidget = ({ profile, status, onSync }) => {
  if (!profile && !status?.linked) return null;

  const topGenres = profile?.top_genres?.slice(0, 5) || [];
  const topArtists = profile?.top_artists?.slice(0, 4) || [];

  return (
    <motion.div
      className="card"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: 'linear-gradient(135deg, rgba(29, 185, 84, 0.06) 0%, rgba(0,0,0,0) 100%)',
        borderColor: 'rgba(29, 185, 84, 0.15)',
        padding: '1.25rem'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: topGenres.length > 0 ? '1rem' : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'rgba(29, 185, 84, 0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#1DB954', flexShrink: 0
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381C8.88 5.82 15.78 6.12 20.1 8.82c.54.3.72 1.02.42 1.56-.299.421-1.02.599-1.439.3z" />
            </svg>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>
              Spotify connected
              <span style={{ color: '#1DB954', marginLeft: '0.4rem', fontSize: '0.75rem', fontWeight: 600 }}>&#10003;</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
              {status?.last_synced_at ? `Synced ${new Date(status.last_synced_at).toLocaleDateString('en-IE')}` : 'Events matched to your taste'}
            </div>
          </div>
        </div>
        <button className="btn btn-sm btn-ghost" onClick={onSync} style={{ fontSize: '0.78rem', flexShrink: 0 }}>
          Sync now
        </button>
      </div>

      {/* Top genres */}
      {topGenres.length > 0 && (
        <div style={{ marginBottom: topArtists.length > 0 ? '0.75rem' : 0 }}>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>
            Your top genres
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {topGenres.map(g => (
              <span key={typeof g === 'object' ? g.genre : g} className="chip chip-active" style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem' }}>
                {typeof g === 'object' ? g.genre : g}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Top artists */}
      {topArtists.length > 0 && (
        <div>
          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>
            Your top artists
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {topArtists.map(a => {
              const name = typeof a === 'string' ? a : a.name || a;
              return (
                <span key={name} className="chip" style={{ fontSize: '0.72rem', padding: '0.25rem 0.6rem', borderColor: 'rgba(29, 185, 84, 0.2)' }}>
                  {name}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </motion.div>
  );
};

const Dashboard = () => {
  const [events, setEvents] = useState([]);
  const [feedEvents, setFeedEvents] = useState([]);
  const [mlRecommendations, setMlRecommendations] = useState([]);
  const [djs, setDjs] = useState([]);
  const [venues, setVenues] = useState([]);
  const [spotifyStatus, setSpotifyStatus] = useState(null);
  const [spotifyProfile, setSpotifyProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeGenre, setActiveGenre] = useState('All');
  const [savedIds, setSavedIds] = useState(new Set());
  const [explainModalOpen, setExplainModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);

  const token = getToken();
  const authBase = process.env.REACT_APP_AUTH_BASE || 'https://auth.whatsthecraic.run.place';

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const requests = [
          eventsAPI.searchEvents({ limit: 200 }),
          djAPI.getAllDJs(),
          venueAPI.getAllVenues()
        ];
        if (token) {
          requests.push(eventsAPI.getFeed({ limit: 20 }));
          // Get ML recommendations (collaborative filtering)
          requests.push(mlAPI.getRecommendations({ limit: 12 }));
        }

        const results = await Promise.all(requests);
        setEvents(results[0].events || []);
        setDjs(Array.isArray(results[1]) ? results[1] : []);
        setVenues(Array.isArray(results[2]) ? results[2] : []);
        if (results[3]) setFeedEvents(results[3].events || []);
        if (results[4]?.recommendations) {
          setMlRecommendations(results[4].recommendations);
        }
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
    authAPI.getSpotifyProfile()
      .then(setSpotifyProfile)
      .catch(() => setSpotifyProfile(null));
  }, [token]);

  const handleSave = async (id) => {
    try {
      await eventsAPI.saveEvent(id);
      setSavedIds(prev => new Set([...prev, id]));
      // Send feedback to ML service
      mlAPI.sendFeedback({
        eventId: id,
        action: 'save',
        context: { page: 'dashboard' }
      }).catch(() => {}); // Silent fail
    } catch (e) { console.error('Save failed:', e); }
  };

  const handleCardClick = (event) => {
    // Track click event for ML
    mlAPI.sendFeedback({
      eventId: event.id,
      action: 'click',
      context: { page: 'dashboard', event_title: event.title }
    }).catch(() => {}); // Silent fail
  };

  const handleExplain = (event) => {
    setSelectedEvent(event);
    setExplainModalOpen(true);
  };

  const handleSyncSpotify = () => {
    authAPI.syncSpotify()
      .then(() => {
        authAPI.getSpotifyStatus().then(setSpotifyStatus).catch(() => {});
        authAPI.getSpotifyProfile().then(setSpotifyProfile).catch(() => {});
      })
      .catch(() => {});
  };

  // Prioritize events with images
  const eventsWithImages = events.filter(e => e.images?.length > 0);
  const heroEvents = eventsWithImages.length >= 3 ? eventsWithImages : events;

  // Filter events by genre
  const filteredEvents = activeGenre === 'All'
    ? events
    : events.filter(e => (e.genres || []).some(g => g.toLowerCase().includes(activeGenre.toLowerCase())));

  // Personalized or trending - prefer feed events which have ML ranking
  const personalizedEvents = feedEvents.length > 0 ? feedEvents : events;

  // Upcoming events sorted
  const upcoming = [...events]
    .filter(e => new Date(e.start_time) > new Date())
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

  // Premium ML sections
  // 1. Highest-scored event for hero
  const topScoredEvent = feedEvents.length > 0
    ? feedEvents.reduce((best, curr) => (curr.rank_score || 0) > (best.rank_score || 0) ? curr : best, feedEvents[0])
    : eventsWithImages[0] || events[0];

  // 2. This Weekend events (Friday-Sunday)
  const now = new Date();
  const thisWeekend = [...events]
    .filter(e => {
      const eventDate = new Date(e.start_time);
      if (eventDate < now) return false;
      const dayOfWeek = eventDate.getDay();
      const daysUntilFriday = (5 - now.getDay() + 7) % 7;
      const thisFriday = new Date(now);
      thisFriday.setDate(now.getDate() + daysUntilFriday);
      thisFriday.setHours(0, 0, 0, 0);
      const thisSunday = new Date(thisFriday);
      thisSunday.setDate(thisFriday.getDate() + 2);
      thisSunday.setHours(23, 59, 59, 999);
      return eventDate >= thisFriday && eventDate <= thisSunday;
    })
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    .slice(0, 10);

  // 3. Trending Near You (by save count or ML popularity score)
  const trending = [...events]
    .filter(e => e.save_count || e.rank_score)
    .sort((a, b) => (b.save_count || 0) - (a.save_count || 0) || (b.rank_score || 0) - (a.rank_score || 0))
    .slice(0, 12);

  // 4. By Genre grouping
  const topUserGenres = spotifyProfile?.top_genres?.slice(0, 3) || [];
  const eventsByGenre = topUserGenres.map(genreObj => {
    const genreName = typeof genreObj === 'object' ? genreObj.genre : genreObj;
    return {
      genre: genreName,
      events: events
        .filter(e => (e.genres || []).some(g => g.toLowerCase().includes(genreName.toLowerCase())))
        .slice(0, 6)
    };
  }).filter(g => g.events.length > 0);

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
      {/* ─── PREMIUM HERO: HIGHEST ML MATCH ─── */}
      {topScoredEvent && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', minHeight: 500 }}
        >
          {getBestImage(topScoredEvent.images, 'hero', 1400) ? (
            <img
              src={getBestImage(topScoredEvent.images, 'hero', 1400)}
              alt={topScoredEvent.title}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
          ) : (
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #1a1a1a, #0a0a0a)' }} />
          )}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.85) 100%)'
          }} />
          <div style={{
            position: 'relative',
            zIndex: 2,
            padding: 'clamp(2rem, 5vw, 3.5rem)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            minHeight: 500
          }}>
            {topScoredEvent.rank_score && topScoredEvent.rank_score > 0.7 && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.4 }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  borderRadius: 12,
                  background: 'rgba(0, 214, 125, 0.2)',
                  backdropFilter: 'blur(12px)',
                  border: '1.5px solid #00d67d',
                  color: '#00d67d',
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  width: 'fit-content',
                  marginBottom: '1rem'
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14 2 9.27l6.91-1.01z"/>
                </svg>
                {Math.round(topScoredEvent.rank_score * 100)}% Match
              </motion.div>
            )}
            <motion.h1
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              style={{
                fontSize: 'clamp(1.8rem, 5vw, 3.5rem)',
                fontWeight: 900,
                letterSpacing: '-0.04em',
                lineHeight: 1.1,
                marginBottom: '1rem',
                textShadow: '0 2px 20px rgba(0,0,0,0.5)'
              }}
            >
              {topScoredEvent.title}
            </motion.h1>
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center', marginBottom: '1.5rem' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9,22 9,12 15,12 15,22"/>
                </svg>
                <span style={{ fontSize: '1rem', fontWeight: 600 }}>{topScoredEvent.venue_name || 'Venue TBA'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#00d67d' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <span style={{ fontSize: '1rem', fontWeight: 700 }}>
                  {formatDate(topScoredEvent.start_time)} {formatTime(topScoredEvent.start_time) && `\u00B7 ${formatTime(topScoredEvent.start_time)}`}
                </span>
              </div>
            </motion.div>
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}
            >
              {topScoredEvent.ticket_url && (
                <a
                  href={topScoredEvent.ticket_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary"
                  style={{
                    padding: '0.85rem 2rem',
                    fontSize: '1rem',
                    fontWeight: 700,
                    borderRadius: 12,
                    background: '#00d67d',
                    color: '#000'
                  }}
                >
                  Get Tickets
                </a>
              )}
              {token && (
                <button
                  onClick={() => handleSave(topScoredEvent.id)}
                  className="btn btn-outline"
                  style={{
                    padding: '0.85rem 1.5rem',
                    fontSize: '1rem',
                    fontWeight: 700,
                    borderRadius: 12,
                    borderColor: 'rgba(255,255,255,0.3)',
                    color: '#fff'
                  }}
                >
                  {savedIds.has(topScoredEvent.id) ? '\u2764\uFE0F Saved' : '\u2661 Save'}
                </button>
              )}
            </motion.div>
          </div>
        </motion.section>
      )}

      {/* ─── SPOTIFY CTA (not linked) ─── */}
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
          <a className="btn" href={`${authBase}/auth/spotify/login?token=${token}`}>Connect Spotify</a>
        </motion.section>
      )}

      {/* ─── SPOTIFY PROFILE (linked) ─── */}
      {token && spotifyStatus?.linked && (
        <SpotifyProfileWidget profile={spotifyProfile} status={spotifyStatus} onSync={handleSyncSpotify} />
      )}

      {/* ─── TASTE PROFILE PANEL ─── */}
      {token && spotifyStatus?.linked && (
        <TasteProfilePanel />
      )}

      {/* ─── THIS WEEKEND CAROUSEL ─── */}
      {thisWeekend.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="section-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h2 className="section-header-title">This weekend</h2>
              <span className="badge" style={{ fontSize: '0.6rem', background: 'rgba(255, 215, 0, 0.15)', color: '#ffd700' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                Fri-Sun
              </span>
            </div>
          </div>
          <div className="scroll-row" style={{ gap: '1rem' }}>
            {thisWeekend.map((event, i) => {
              const img = getBestImage(event.images, 'card', 500);
              return (
                <motion.div
                  key={event.id || i}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="card-event"
                  style={{ width: 280, flexShrink: 0 }}
                >
                  <div className="card-event-img-wrap" style={{ paddingTop: '75%', cursor: 'pointer' }} onClick={() => handleCardClick(event)}>
                    {img ? (
                      <img src={img} alt={event.title} className="card-event-img" loading="lazy" />
                    ) : (
                      <div className="card-event-img-placeholder">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ color: 'var(--muted-2)' }}>
                          <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                        </svg>
                      </div>
                    )}
                    <div className="card-event-overlay" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.8) 100%)' }}>
                      <div style={{ position: 'absolute', bottom: 10, left: 10, right: 10 }}>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#ffd700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.25rem' }}>
                          {formatDate(event.start_time)}
                        </div>
                        {formatTime(event.start_time) && (
                          <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)' }}>
                            {formatTime(event.start_time)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="card-event-body">
                    <h3 className="line-clamp-2" style={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.3, marginBottom: '0.4rem' }}>
                      {event.title}
                    </h3>
                    <div className="venue-strip">
                      <div className="venue-strip-dot" />
                      <span className="venue-strip-name">{event.venue_name || 'Venue TBA'}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
                      {(event.genres || []).slice(0, 2).map(g => (
                        <span key={g} className="chip" style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem' }}>{g}</span>
                      ))}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.section>
      )}

      {/* ─── TRENDING NEAR YOU ─── */}
      {trending.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="section-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h2 className="section-header-title">Trending near you</h2>
              <span className="badge" style={{ fontSize: '0.6rem', background: 'rgba(255, 107, 107, 0.15)', color: '#ff6b6b' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                </svg>
                Hot
              </span>
            </div>
            <Link to="/discover" className="section-header-link">See all &rarr;</Link>
          </div>
          <div className="grid-events">
            {trending.slice(0, 6).map((event, i) => (
              <EventCard
                key={event.id || i}
                event={event}
                index={i}
                saved={savedIds.has(event.id)}
                onSave={handleSave}
                onCardClick={handleCardClick}
                onExplain={handleExplain}
                showFeedback={token && (event.rank_reasons || event.rank_score)}
              />
            ))}
          </div>
        </motion.section>
      )}

      {/* ─── BECAUSE YOU LIKE [GENRE] ─── */}
      {token && eventsByGenre.length > 0 && eventsByGenre.map((genreGroup, idx) => (
        <motion.section
          key={genreGroup.genre}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 * idx }}
        >
          <div className="section-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h2 className="section-header-title">Because you like {genreGroup.genre}</h2>
              <span className="badge" style={{ fontSize: '0.6rem', background: 'rgba(138, 43, 226, 0.15)', color: '#8a2be2' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14 2 9.27l6.91-1.01z"/>
                </svg>
                Your Taste
              </span>
            </div>
          </div>
          <div className="scroll-row">
            {genreGroup.events.map((event, i) => {
              const img = getBestImage(event.images, 'card', 400);
              return (
                <motion.div
                  key={event.id || i}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="card-event"
                  style={{ width: 220, flexShrink: 0 }}
                >
                  <div className="card-event-img-wrap" style={{ paddingTop: '100%', cursor: 'pointer' }} onClick={() => handleCardClick(event)}>
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
                    <MatchBadge reasons={event.rank_reasons} score={event.rank_score} />
                    <h3 className="line-clamp-2" style={{ fontWeight: 700, fontSize: '0.88rem', lineHeight: 1.3, marginBottom: '0.3rem', marginTop: event.rank_reasons ? '0.3rem' : 0 }}>
                      {event.title}
                    </h3>
                    <div className="venue-strip">
                      <div className="venue-strip-dot" />
                      <span className="venue-strip-name">{event.venue_name || 'TBA'}</span>
                    </div>
                    <span style={{ fontSize: '0.72rem', color: 'var(--emerald)', fontWeight: 600, display: 'block', marginTop: '0.3rem' }}>
                      {formatDate(event.start_time)}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.section>
      ))}

      {/* ─── FANS LIKE YOU ALSO SAVED (ML Collaborative Filtering) ─── */}
      {token && mlRecommendations.length > 0 && (
        <section>
          <div className="section-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h2 className="section-header-title">Fans like you also saved</h2>
              <span className="badge" style={{ fontSize: '0.6rem', background: '#4fc3f722', color: '#4fc3f7' }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14 2 9.27l6.91-1.01z"/></svg>
                ML Picks
              </span>
            </div>
            <Link to="/discover" className="section-header-link">See all &rarr;</Link>
          </div>
          <div className="scroll-row">
            {mlRecommendations.map((event, i) => {
              const img = getBestImage(event.images, 'card', 400);
              return (
                <div key={event.id || i} className="card-event" style={{ width: 220, flexShrink: 0 }}>
                  <div className="card-event-img-wrap" style={{ paddingTop: '100%', cursor: 'pointer' }} onClick={() => handleCardClick(event)}>
                    {img ? (
                      <img src={img} alt={event.title} className="card-event-img" loading="lazy" />
                    ) : (
                      <div className="card-event-img-placeholder">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ color: 'var(--muted-2)' }}>
                          <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                        </svg>
                      </div>
                    )}
                    {/* Match score indicator */}
                    {event.rank_score > 0 && (
                      <div style={{
                        position: 'absolute', top: 8, right: 8, zIndex: 3,
                        width: 32, height: 32, borderRadius: 8,
                        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: event.rank_score > 0.7 ? 'var(--emerald)' : event.rank_score > 0.4 ? 'var(--gold)' : 'var(--muted)',
                        fontSize: '0.65rem', fontWeight: 800
                      }}>
                        {Math.round(event.rank_score * 100)}%
                      </div>
                    )}
                  </div>
                  <div className="card-event-body">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <MatchBadge reasons={event.rank_reasons} score={event.rank_score} />
                      {(event.rank_reasons || event.rank_score) && (
                        <button
                          onClick={() => handleExplain(event)}
                          className="btn btn-ghost"
                          style={{
                            fontSize: '0.65rem',
                            padding: '0.2rem 0.5rem',
                            minWidth: 'auto',
                            opacity: 0.7
                          }}
                          title="Why this event?"
                        >
                          ?
                        </button>
                      )}
                    </div>
                    <h3 className="line-clamp-2" style={{ fontWeight: 700, fontSize: '0.88rem', lineHeight: 1.3, marginBottom: '0.3rem', marginTop: event.rank_reasons ? '0.3rem' : 0 }}>{event.title}</h3>
                    <div className="venue-strip">
                      <div className="venue-strip-dot" />
                      <span className="venue-strip-name">{event.venue_name || 'TBA'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--emerald)', fontWeight: 600 }}>
                        {formatDate(event.start_time)}
                      </span>
                      <FeedbackButtons
                        eventId={event.id}
                        size="sm"
                        context={{ page: 'dashboard', section: 'ml_recommendations', position: i }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ─── FOR YOU (Personalized with ML) ─── */}
      {token && personalizedEvents.length > 0 && (
        <section>
          <div className="section-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <h2 className="section-header-title">For you</h2>
              {feedEvents.length > 0 && (
                <span className="badge" style={{ fontSize: '0.6rem' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14 2 9.27l6.91-1.01z"/></svg>
                  AI Picks
                </span>
              )}
            </div>
            <Link to="/discover" className="section-header-link">See all &rarr;</Link>
          </div>
          <div className="scroll-row">
            {personalizedEvents.slice(0, 12).map((event, i) => {
              const img = getBestImage(event.images, 'card', 400);
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
                    {/* Match score indicator */}
                    {event.rank_score > 0 && (
                      <div style={{
                        position: 'absolute', top: 8, right: 8, zIndex: 3,
                        width: 32, height: 32, borderRadius: 8,
                        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: event.rank_score > 0.7 ? 'var(--emerald)' : event.rank_score > 0.4 ? 'var(--gold)' : 'var(--muted)',
                        fontSize: '0.65rem', fontWeight: 800
                      }}>
                        {Math.round(event.rank_score * 100)}%
                      </div>
                    )}
                  </div>
                  <div className="card-event-body">
                    <MatchBadge reasons={event.rank_reasons} score={event.rank_score} />
                    <h3 className="line-clamp-2" style={{ fontWeight: 700, fontSize: '0.88rem', lineHeight: 1.3, marginBottom: '0.3rem', marginTop: event.rank_reasons ? '0.3rem' : 0 }}>{event.title}</h3>
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
        {feedEvents.length > 0 && (
          <div className="stat-pill animate-fade-up">
            <div className="stat-pill-icon" style={{ background: 'var(--violet-dim)', color: 'var(--violet)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14 2 9.27l6.91-1.01z"/></svg>
            </div>
            <div>
              <div className="stat-pill-value" style={{ color: 'var(--violet)' }}>{feedEvents.length}</div>
              <div className="stat-pill-label">Matched for you</div>
            </div>
          </div>
        )}
      </section>

      {/* ─── EVENT DENSITY HEATMAP ─── */}
      <EventDensityHeatMap />

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
        <AnimatePresence mode="wait">
          <motion.div
            key={activeGenre}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="grid-events"
          >
            {filteredEvents.slice(0, 12).map((event, i) => (
              <EventCard
                key={event.id || i}
                event={event}
                index={i}
                saved={savedIds.has(event.id)}
                onSave={handleSave}
                onCardClick={handleCardClick}
                onExplain={handleExplain}
                showFeedback={token && (event.rank_reasons || event.rank_score)}
              />
            ))}
          </motion.div>
        </AnimatePresence>
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
            {upcoming.slice(0, 10).map((event, i) => (
              <UpcomingEventCard key={event.id || i} event={event} index={i} />
            ))}
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
          {djs.slice(0, 10).map((dj) => {
            const DJCardWithImage = () => {
              const [djImage, setDjImage] = useState(null);
              const [loadingImage, setLoadingImage] = useState(false);

              useEffect(() => {
                const loadImage = async () => {
                  if (!loadingImage && dj.dj_name) {
                    setLoadingImage(true);
                    const image = await fetchArtistImage(dj.dj_name);
                    if (image) setDjImage(image);
                    setLoadingImage(false);
                  }
                };
                loadImage();
              }, []);

              return (
                <Link to="/djs" key={dj.dj_id} className="card-artist" style={{ width: 180, flexShrink: 0 }}>
                  <div className="card-artist-img-wrap">
                    {djImage ? (
                      <img src={djImage} alt={dj.dj_name} className="card-artist-img" loading="lazy" />
                    ) : (
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: `linear-gradient(135deg, hsl(${(dj.dj_id * 67) % 360}, 40%, 18%), hsl(${(dj.dj_id * 31) % 360}, 25%, 12%))`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <span style={{ fontSize: '2rem', fontWeight: 800, color: 'rgba(255,255,255,0.15)' }}>
                          {(dj.dj_name || '?')[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="card-artist-body">
                    <h3 className="line-clamp-1" style={{ fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.15rem' }}>{dj.dj_name}</h3>
                    <p className="line-clamp-1" style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{dj.genres || 'Various'}</p>
                    <span style={{ fontSize: '0.68rem', color: 'var(--emerald)' }}>{dj.city || 'Ireland'}</span>
                  </div>
                </Link>
              );
            };

            return <DJCardWithImage key={dj.dj_id} />;
          })}
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

      {/* ─── EXPLAINABILITY MODAL ─── */}
      <ExplainabilityModal
        isOpen={explainModalOpen}
        onClose={() => setExplainModalOpen(false)}
        event={selectedEvent}
      />
    </div>
  );
};

export default Dashboard;
