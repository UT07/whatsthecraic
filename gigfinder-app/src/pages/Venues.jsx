// src/pages/Venues.jsx
import React, { useState, useEffect, useCallback } from 'react';
import venueAPI from '../services/venueAPI';
import eventsAPI from '../services/eventsAPI';
import { getUser } from '../services/apiClient';

/* ── helpers ─────────────────────────────────────────────────────── */
const fmt = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' });
};
const fmtTime = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' });
};

const VENUE_COLORS = [
  'linear-gradient(135deg, #1a3a2a 0%, #0d1f17 100%)',
  'linear-gradient(135deg, #2a1a3a 0%, #170d1f 100%)',
  'linear-gradient(135deg, #1a2a3a 0%, #0d171f 100%)',
  'linear-gradient(135deg, #3a2a1a 0%, #1f170d 100%)',
  'linear-gradient(135deg, #1a3a3a 0%, #0d1f1f 100%)',
  'linear-gradient(135deg, #3a1a2a 0%, #1f0d17 100%)',
];

const GENRE_ICONS = {
  electronic: '⚡', techno: '🔊', house: '🏠', 'hip-hop': '🎤',
  rock: '🎸', jazz: '🎷', trad: '🍀', folk: '🪕', pop: '🎵',
  indie: '🎹', metal: '🤘', classical: '🎻', default: '🎶'
};

const getGenreIcon = (genre) => {
  if (!genre) return GENRE_ICONS.default;
  const key = genre.toLowerCase();
  return GENRE_ICONS[key] || GENRE_ICONS.default;
};

/* ── Skeleton ────────────────────────────────────────────────────── */
const VenueSkeleton = () => (
  <div className="card-venue" style={{ minHeight: 280 }}>
    <div className="skeleton" style={{ height: 160, borderRadius: '12px 12px 0 0' }} />
    <div style={{ padding: '1rem' }}>
      <div className="skeleton" style={{ height: 18, width: '70%', marginBottom: 8 }} />
      <div className="skeleton" style={{ height: 14, width: '50%' }} />
    </div>
  </div>
);

/* ── Event mini card (shown inside venue detail) ─────────────────── */
const VenueEventCard = ({ event, onSave }) => {
  const img = event.image_url || event.imageUrl;
  return (
    <div style={{
      display: 'flex', gap: '0.75rem', padding: '0.75rem',
      background: 'rgba(255,255,255,0.03)', borderRadius: 12,
      border: '1px solid var(--line)', transition: 'background 0.2s'
    }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
      onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
    >
      {/* Thumbnail */}
      <div style={{
        width: 72, height: 72, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
        background: img ? 'transparent' : 'linear-gradient(135deg, var(--emerald-dim) 0%, rgba(0,214,125,0.05) 100%)'
      }}>
        {img ? (
          <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{
            width: '100%', height: '100%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '1.5rem'
          }}>
            {getGenreIcon(event.genre)}
          </div>
        )}
      </div>

      {/* Details */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.78rem', color: 'var(--emerald)', fontWeight: 600, marginBottom: 2 }}>
          {fmt(event.date || event.start_date)} · {fmtTime(event.date || event.start_date)}
        </div>
        <div style={{
          fontSize: '0.92rem', fontWeight: 600, color: 'var(--ink)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
        }}>
          {event.name || event.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: 4, flexWrap: 'wrap' }}>
          {event.genre && (
            <span className="chip" style={{ fontSize: '0.68rem' }}>{event.genre}</span>
          )}
          {(event.source) && (
            <span style={{ fontSize: '0.65rem', color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              via {event.source}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }}>
        {event.ticket_url && (
          <a href={event.ticket_url} target="_blank" rel="noreferrer"
            style={{
              padding: '0.3rem 0.6rem', borderRadius: 8, fontSize: '0.7rem', fontWeight: 600,
              background: 'var(--emerald)', color: '#000', textDecoration: 'none'
            }}>
            Tickets
          </a>
        )}
        <button onClick={() => onSave(event)}
          style={{
            background: 'none', border: '1px solid var(--line)', borderRadius: 8,
            padding: '0.3rem 0.5rem', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--ink-2)'
          }}>
          ♡
        </button>
      </div>
    </div>
  );
};

/* ── Main Venues Page ────────────────────────────────────────────── */
const Venues = () => {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [genreFilter, setGenreFilter] = useState('');

  // Venue detail / events panel
  const [selectedVenue, setSelectedVenue] = useState(null);
  const [venueEvents, setVenueEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  const user = getUser();
  const isOrganizer = user?.role === 'organizer' || user?.role === 'admin';

  /* ── fetch venues ──────────────────────────────────────────────── */
  const fetchVenues = useCallback(async () => {
    setLoading(true);
    try {
      const hasFilters = search || cityFilter || genreFilter;
      let data;
      if (hasFilters) {
        const filters = {};
        if (search) filters.q = search;
        if (cityFilter) filters.city = cityFilter;
        if (genreFilter) filters.genreFocus = genreFilter;
        data = await venueAPI.searchVenues(filters);
        setVenues(data.venues || []);
      } else {
        data = await venueAPI.getAllVenues();
        setVenues(Array.isArray(data) ? data : (data.venues || []));
      }
    } catch (err) {
      console.error('Error fetching venues:', err);
    } finally {
      setLoading(false);
    }
  }, [search, cityFilter, genreFilter]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchVenues(); }, []);

  /* ── fetch events for a venue ──────────────────────────────────── */
  const openVenueEvents = async (venue) => {
    setSelectedVenue(venue);
    setEventsLoading(true);
    setVenueEvents([]);
    try {
      const data = await eventsAPI.searchEvents({ venue: venue.name, limit: 30 });
      setVenueEvents(data.events || []);
    } catch (err) {
      console.error('Error fetching venue events:', err);
    } finally {
      setEventsLoading(false);
    }
  };

  const closeVenuePanel = () => {
    setSelectedVenue(null);
    setVenueEvents([]);
  };

  const handleSaveEvent = async (event) => {
    try {
      await eventsAPI.saveEvent(event.id);
    } catch (err) {
      console.error('Error saving event:', err);
    }
  };

  /* ── derived ───────────────────────────────────────────────────── */
  const cities = [...new Set(venues.map(v => v.city || v.address?.split(',').pop()?.trim()).filter(Boolean))];
  const genres = [...new Set(venues.map(v => v.genreFocus).filter(Boolean))];

  const filteredVenues = venues.filter(v => {
    const matchSearch = !search || v.name?.toLowerCase().includes(search.toLowerCase()) ||
      v.address?.toLowerCase().includes(search.toLowerCase());
    const matchCity = !cityFilter || (v.city || v.address || '').toLowerCase().includes(cityFilter.toLowerCase());
    const matchGenre = !genreFilter || (v.genreFocus || '').toLowerCase().includes(genreFilter.toLowerCase());
    return matchSearch && matchCity && matchGenre;
  });

  /* ── render ────────────────────────────────────────────────────── */
  return (
    <div style={{ position: 'relative' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div className="badge" style={{ marginBottom: 8 }}>Discover by venue</div>
        <h1 className="section-title" style={{ fontSize: '1.8rem', marginBottom: 4 }}>
          Irish Venues
        </h1>
        <p className="section-subtitle">
          Explore Ireland's best live music spots and see what's on at each venue
        </p>
      </div>

      {/* Search & Filter Bar */}
      <div style={{
        display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1.5rem',
        padding: '0.75rem', background: 'var(--card)', borderRadius: 14,
        border: '1px solid var(--line)'
      }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--ink-3)" strokeWidth="2"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="input"
            placeholder="Search venues..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchVenues()}
            style={{ paddingLeft: 36, width: '100%' }}
          />
        </div>
        {cities.length > 0 && (
          <select className="input" value={cityFilter} onChange={e => setCityFilter(e.target.value)}
            style={{ minWidth: 140 }}>
            <option value="">All cities</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        {genres.length > 0 && (
          <select className="input" value={genreFilter} onChange={e => setGenreFilter(e.target.value)}
            style={{ minWidth: 140 }}>
            <option value="">All genres</option>
            {genres.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        )}
        <button className="btn btn-primary btn-sm" onClick={fetchVenues}>Search</button>
      </div>

      {/* Stats strip */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div className="stat-pill">
          <span style={{ color: 'var(--emerald)' }}>📍</span>
          <span>{filteredVenues.length} venue{filteredVenues.length !== 1 ? 's' : ''}</span>
        </div>
        {cities.length > 0 && (
          <div className="stat-pill">
            <span style={{ color: 'var(--emerald)' }}>🏙️</span>
            <span>{cities.length} cit{cities.length !== 1 ? 'ies' : 'y'}</span>
          </div>
        )}
      </div>

      {/* Venue Grid */}
      {loading ? (
        <div className="grid-auto">
          {[...Array(6)].map((_, i) => <VenueSkeleton key={i} />)}
        </div>
      ) : filteredVenues.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '3rem 1rem',
          background: 'var(--card)', borderRadius: 16, border: '1px solid var(--line)'
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🏛️</div>
          <h3 style={{ color: 'var(--ink)', marginBottom: 4 }}>No venues found</h3>
          <p style={{ color: 'var(--ink-3)', fontSize: '0.88rem' }}>
            Try adjusting your search or filters
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1rem'
        }}>
          {filteredVenues.map((venue, idx) => (
            <div
              key={venue.id}
              className="card-venue"
              onClick={() => openVenueEvents(venue)}
              style={{ cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,214,125,0.08)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              {/* Venue image / placeholder */}
              <div style={{
                height: 170, borderRadius: '12px 12px 0 0', overflow: 'hidden', position: 'relative',
                background: venue.image_url ? 'transparent' : VENUE_COLORS[idx % VENUE_COLORS.length],
              }}>
                {venue.image_url ? (
                  <img src={venue.image_url} alt={venue.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    width: '100%', height: '100%', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', flexDirection: 'column', gap: 4
                  }}>
                    <div style={{ fontSize: '2.5rem', opacity: 0.6 }}>
                      {getGenreIcon(venue.genreFocus)}
                    </div>
                    <div style={{
                      fontSize: '1.3rem', fontWeight: 700, color: 'rgba(255,255,255,0.25)',
                      letterSpacing: '0.04em'
                    }}>
                      {(venue.name || '')[0]?.toUpperCase()}
                    </div>
                  </div>
                )}

                {/* Capacity badge */}
                {venue.capacity && (
                  <div style={{
                    position: 'absolute', top: 10, right: 10,
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
                    padding: '0.25rem 0.55rem', borderRadius: 8,
                    fontSize: '0.7rem', fontWeight: 600, color: 'var(--ink-2)'
                  }}>
                    {venue.capacity} cap
                  </div>
                )}

                {/* City badge */}
                {(venue.city || venue.address) && (
                  <div style={{
                    position: 'absolute', bottom: 10, left: 10,
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
                    padding: '0.2rem 0.5rem', borderRadius: 6,
                    fontSize: '0.68rem', fontWeight: 500, color: 'var(--ink-2)',
                    display: 'flex', alignItems: 'center', gap: 4
                  }}>
                    <span style={{ color: 'var(--emerald)' }}>📍</span>
                    {venue.city || venue.address?.split(',').pop()?.trim() || 'Ireland'}
                  </div>
                )}
              </div>

              {/* Venue info */}
              <div style={{ padding: '0.85rem 1rem' }}>
                <h3 style={{
                  fontSize: '1rem', fontWeight: 700, color: 'var(--ink)', marginBottom: 4,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                }}>
                  {venue.name}
                </h3>
                {venue.address && (
                  <p style={{
                    fontSize: '0.78rem', color: 'var(--ink-3)', marginBottom: 6,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                  }}>
                    {venue.address}
                  </p>
                )}
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {venue.genreFocus && (
                    <span className="chip" style={{ fontSize: '0.68rem' }}>
                      {getGenreIcon(venue.genreFocus)} {venue.genreFocus}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Venue Events Drawer / Modal ──────────────────────────────── */}
      {selectedVenue && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          display: 'flex', justifyContent: 'flex-end'
        }}>
          {/* Backdrop */}
          <div
            onClick={closeVenuePanel}
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)'
            }}
          />

          {/* Panel */}
          <div style={{
            position: 'relative', width: '100%', maxWidth: 520,
            background: 'var(--bg)', borderLeft: '1px solid var(--line)',
            overflowY: 'auto', display: 'flex', flexDirection: 'column',
            animation: 'fadeIn 0.25s ease'
          }}>
            {/* Venue header */}
            <div style={{
              position: 'relative', height: 200, overflow: 'hidden', flexShrink: 0,
              background: selectedVenue.image_url ? 'transparent' :
                VENUE_COLORS[venues.findIndex(v => v.id === selectedVenue.id) % VENUE_COLORS.length]
            }}>
              {selectedVenue.image_url ? (
                <img src={selectedVenue.image_url} alt={selectedVenue.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{
                  width: '100%', height: '100%', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: '4rem', opacity: 0.3
                }}>
                  {getGenreIcon(selectedVenue.genreFocus)}
                </div>
              )}

              {/* Gradient overlay */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, height: '60%',
                background: 'linear-gradient(transparent, var(--bg))'
              }} />

              {/* Close button */}
              <button
                onClick={closeVenuePanel}
                style={{
                  position: 'absolute', top: 12, right: 12,
                  width: 36, height: 36, borderRadius: 10,
                  background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--ink)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem'
                }}
              >
                ✕
              </button>

              {/* Venue name overlay */}
              <div style={{
                position: 'absolute', bottom: 16, left: 20, right: 20
              }}>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--ink)', marginBottom: 4 }}>
                  {selectedVenue.name}
                </h2>
                {selectedVenue.address && (
                  <p style={{ fontSize: '0.82rem', color: 'var(--ink-2)' }}>
                    📍 {selectedVenue.address}
                  </p>
                )}
              </div>
            </div>

            {/* Venue meta */}
            <div style={{
              display: 'flex', gap: '0.5rem', flexWrap: 'wrap',
              padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--line)'
            }}>
              {selectedVenue.capacity && (
                <div className="stat-pill">
                  <span>👥</span>
                  <span>{selectedVenue.capacity} capacity</span>
                </div>
              )}
              {selectedVenue.genreFocus && (
                <div className="stat-pill">
                  <span>{getGenreIcon(selectedVenue.genreFocus)}</span>
                  <span>{selectedVenue.genreFocus}</span>
                </div>
              )}
              {selectedVenue.notes && (
                <p style={{ width: '100%', fontSize: '0.8rem', color: 'var(--ink-3)', marginTop: 4 }}>
                  {selectedVenue.notes}
                </p>
              )}
            </div>

            {/* Events at this venue */}
            <div style={{ padding: '1rem 1.25rem', flex: 1 }}>
              <h3 style={{
                fontSize: '0.92rem', fontWeight: 700, color: 'var(--ink)',
                marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: 6
              }}>
                <span style={{ color: 'var(--emerald)' }}>🎫</span>
                Events at {selectedVenue.name}
                {!eventsLoading && (
                  <span style={{
                    marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--ink-3)',
                    fontWeight: 500
                  }}>
                    {venueEvents.length} event{venueEvents.length !== 1 ? 's' : ''}
                  </span>
                )}
              </h3>

              {eventsLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="skeleton" style={{ height: 80, borderRadius: 12 }} />
                  ))}
                </div>
              ) : venueEvents.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: '2rem 1rem',
                  background: 'rgba(255,255,255,0.02)', borderRadius: 14,
                  border: '1px solid var(--line)'
                }}>
                  <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🔇</div>
                  <p style={{ color: 'var(--ink-3)', fontSize: '0.85rem' }}>
                    No upcoming events found at this venue
                  </p>
                  <p style={{ color: 'var(--ink-3)', fontSize: '0.75rem', marginTop: 4 }}>
                    Check back soon or set an alert for this venue
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {venueEvents.map(event => (
                    <VenueEventCard
                      key={event.id}
                      event={event}
                      onSave={handleSaveEvent}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Organizer actions (only for admins/organizers) */}
            {isOrganizer && (
              <div style={{
                padding: '0.75rem 1.25rem', borderTop: '1px solid var(--line)',
                background: 'rgba(255,255,255,0.02)', flexShrink: 0
              }}>
                <p style={{ fontSize: '0.72rem', color: 'var(--ink-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Organizer tools
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-outline btn-sm" style={{ fontSize: '0.75rem' }}
                    onClick={() => {/* TODO: link to organizer venue edit */ }}>
                    Edit venue
                  </button>
                  <button className="btn btn-outline btn-sm" style={{ fontSize: '0.75rem' }}
                    onClick={() => {/* TODO: link to availability */ }}>
                    Availability
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Venues;
