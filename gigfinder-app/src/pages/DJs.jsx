import React, { useState, useEffect } from 'react';
import djAPI from '../services/djAPI';
import eventsAPI from '../services/eventsAPI';
import { getUser } from '../services/apiClient';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';

const DJs = () => {
  const user = getUser();
  const isAdmin = user?.role === 'admin';
  const isOrganizerOrAdmin = user?.role === 'organizer' || user?.role === 'admin';
  const [djs, setDjs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDJ, setEditingDJ] = useState(null);
  const [performers, setPerformers] = useState([]);
  const [performersLoading, setPerformersLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('local');

  const [filters, setFilters] = useState({ q: '', city: '', genres: '', feeMax: '' });
  const { register, handleSubmit, reset } = useForm();

  const fetchDJs = async (useSearch = false) => {
    try {
      setLoading(true);
      if (useSearch) {
        const data = await djAPI.searchDJs(filters);
        setDjs(data.djs || []);
      } else {
        const data = await djAPI.getAllDJs();
        setDjs(data);
      }
    } catch (error) {
      console.error("Error fetching DJs:", error);
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchDJs(); }, []);

  const runSearch = async () => {
    setSearching(true);
    await fetchDJs(true);
    setSearching(false);
  };

  const resetSearch = async () => {
    setFilters({ q: '', city: '', genres: '', feeMax: '' });
    await fetchDJs(false);
  };

  const loadPerformers = async () => {
    setPerformersLoading(true);
    try {
      const data = await eventsAPI.getPerformers({
        city: filters.city || undefined,
        q: filters.q || undefined,
        include: 'ticketmaster,spotify,mixcloud',
        limit: 200
      });
      setPerformers(data.performers || []);
    } catch (error) {
      console.error('Error loading performers:', error);
      setPerformers([]);
    } finally {
      setPerformersLoading(false);
    }
  };

  const openModal = (dj = null) => {
    setEditingDJ(dj);
    reset(dj || {});
    setModalOpen(true);
  };

  const closeModal = () => { setEditingDJ(null); setModalOpen(false); };

  const onSubmit = async (formData) => {
    try {
      if (editingDJ) {
        await djAPI.updateDJ(editingDJ.dj_id, formData);
      } else {
        await djAPI.addDJ(formData);
      }
      fetchDJs();
      closeModal();
    } catch (error) {
      console.error("Error adding/updating DJ:", error);
    }
  };

  const handleDeleteDJ = async (djId) => {
    if (window.confirm("Are you sure you want to delete this DJ?")) {
      try {
        await djAPI.deleteDJ(djId);
        fetchDJs();
      } catch (error) {
        console.error("Error deleting DJ:", error);
      }
    }
  };

  // Generate deterministic gradient colors for DJs without images
  const getDJGradient = (id) => {
    const hue1 = (id * 67) % 360;
    const hue2 = (id * 31 + 120) % 360;
    return `linear-gradient(135deg, hsl(${hue1}, 40%, 18%), hsl(${hue2}, 25%, 12%))`;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem' }}>
        <div>
          <span className="badge" style={{ marginBottom: '0.5rem' }}>Local Irish Selection</span>
          <h1 className="section-title" style={{ marginBottom: '0.3rem' }}>Artists & DJs</h1>
          <p className="section-subtitle">Discover Ireland's finest talent and international acts</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-outline btn-sm" onClick={loadPerformers} disabled={performersLoading}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#1DB954' }}>
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2z"/>
            </svg>
            {performersLoading ? 'Loading...' : 'Discover artists'}
          </button>
          {isAdmin && (
            <button onClick={() => openModal()} className="btn btn-primary btn-sm">Add artist</button>
          )}
        </div>
      </div>

      {/* Search */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted-2)' }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input className="input" placeholder="Search artists..." value={filters.q}
            onChange={(e) => setFilters({ ...filters, q: e.target.value })}
            style={{ paddingLeft: '2.5rem' }}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
          />
        </div>
        <input className="input" placeholder="City" value={filters.city} onChange={(e) => setFilters({ ...filters, city: e.target.value })} style={{ width: 130 }} />
        <input className="input" placeholder="Genres" value={filters.genres} onChange={(e) => setFilters({ ...filters, genres: e.target.value })} style={{ width: 130 }} />
        <input className="input" type="number" placeholder="Max fee" value={filters.feeMax} onChange={(e) => setFilters({ ...filters, feeMax: e.target.value })} style={{ width: 110 }} />
        <button className="btn btn-primary btn-sm" onClick={runSearch} disabled={searching}>
          {searching ? 'Searching...' : 'Search'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={resetSearch}>Reset</button>
      </div>

      {/* Tabs */}
      <div className="tabs" style={{ width: 'fit-content' }}>
        <button className={`tab ${activeTab === 'local' ? 'tab-active' : ''}`} onClick={() => setActiveTab('local')}>
          Local Irish ({djs.length})
        </button>
        <button className={`tab ${activeTab === 'discovered' ? 'tab-active' : ''}`} onClick={() => setActiveTab('discovered')}>
          Discovered ({performers.length})
        </button>
      </div>

      {/* Local DJs Grid */}
      {activeTab === 'local' && (
        <section>
          {loading ? (
            <div className="grid-events">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 300, borderRadius: 14 }} />
              ))}
            </div>
          ) : djs.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <p style={{ color: 'var(--muted)' }}>No artists found. Try adjusting your search.</p>
            </div>
          ) : (
            <div className="grid-events">
              {djs.map((dj, index) => (
                <motion.div
                  key={dj.dj_id}
                  className="card-artist"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.03 }}
                >
                  <div className="card-artist-img-wrap">
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: getDJGradient(dj.dj_id),
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <span style={{ fontSize: '2.5rem', fontWeight: 800, color: 'rgba(255,255,255,0.12)' }}>
                        {(dj.dj_name || '?')[0].toUpperCase()}
                      </span>
                    </div>
                    {/* Badge overlay */}
                    <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 2 }}>
                      <span className="badge" style={{ fontSize: '0.6rem' }}>
                        {dj.city || 'Ireland'}
                      </span>
                    </div>
                  </div>
                  <div className="card-artist-body">
                    <h3 className="line-clamp-1" style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: '0.2rem' }}>
                      {dj.dj_name}
                    </h3>
                    <p className="line-clamp-1" style={{ fontSize: '0.75rem', color: 'var(--muted)', marginBottom: '0.4rem' }}>
                      {dj.genres || 'Various genres'}
                    </p>
                    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                      {dj.numeric_fee && (
                        <span className="chip" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem' }}>
                          {dj.currency || 'EUR'} {dj.numeric_fee}
                        </span>
                      )}
                      {dj.instagram && (
                        <span className="chip" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem' }}>IG</span>
                      )}
                      {dj.soundcloud && (
                        <span className="chip" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem' }}>SC</span>
                      )}
                    </div>
                    {isAdmin && (
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        <button onClick={() => openModal(dj)} className="btn btn-outline btn-sm" style={{ flex: 1, fontSize: '0.75rem' }}>Edit</button>
                        <button onClick={() => handleDeleteDJ(dj.dj_id)} className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3,6 5,6 21,6"/><path d="M19,6V20a2,2,0,0,1-2,2H7a2,2,0,0,1-2-2V6M8,6V4a2,2,0,0,1,2-2h4a2,2,0,0,1,2,2V6"/></svg>
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Discovered Performers */}
      {activeTab === 'discovered' && (
        <section>
          {performersLoading ? (
            <div className="grid-events">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 260, borderRadius: 14 }} />
              ))}
            </div>
          ) : performers.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" style={{ color: '#1DB954', margin: '0 auto 1rem' }}>
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2z"/>
              </svg>
              <p style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '0.3rem' }}>Discover artists from Spotify & Ticketmaster</p>
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>Click "Discover artists" to pull artists from your connected platforms</p>
              <button className="btn btn-primary btn-sm" onClick={loadPerformers}>Discover artists</button>
            </div>
          ) : (
            <div className="grid-events">
              {performers.map((performer, index) => (
                <motion.div
                  key={`${performer.name}-${index}`}
                  className="card-artist"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.03 }}
                >
                  <div className="card-artist-img-wrap">
                    {performer.image ? (
                      <img src={performer.image} alt={performer.name} className="card-artist-img" loading="lazy" />
                    ) : (
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: `linear-gradient(135deg, hsl(${(index * 43) % 360}, 35%, 16%), hsl(${(index * 89) % 360}, 20%, 10%))`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <span style={{ fontSize: '2.5rem', fontWeight: 800, color: 'rgba(255,255,255,0.12)' }}>
                          {(performer.name || '?')[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }}>
                      <span className={`badge ${performer.source === 'spotify' ? '' : performer.source === 'mixcloud' ? '' : 'badge-sky'}`}
                        style={{ fontSize: '0.6rem',
                          ...(performer.source === 'spotify' ? { background: 'rgba(29,185,84,0.2)', color: '#1DB954' } : {}),
                          ...(performer.source === 'mixcloud' ? { background: 'rgba(82,177,252,0.2)', color: '#52B1FC' } : {})
                        }}>
                        {performer.source}
                      </span>
                    </div>
                  </div>
                  <div className="card-artist-body">
                    <h3 className="line-clamp-1" style={{ fontWeight: 700, fontSize: '0.92rem', marginBottom: '0.2rem' }}>
                      {performer.name}
                    </h3>
                    {performer.genres && (
                      <p className="line-clamp-1" style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                        {Array.isArray(performer.genres) ? performer.genres.join(', ') : performer.genres}
                      </p>
                    )}
                    {(performer.spotifyUrl || performer.mixcloudUrl) && (
                      <a href={performer.spotifyUrl || performer.mixcloudUrl} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: '0.7rem', color: performer.spotifyUrl ? '#1DB954' : '#52B1FC', marginTop: '0.25rem', display: 'inline-block' }}>
                        View on {performer.spotifyUrl ? 'Spotify' : 'Mixcloud'} ↗
                      </a>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Modal */}
      {modalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div className="glass" style={{ padding: '1.5rem', width: '90%', maxWidth: 440, maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontWeight: 700, fontSize: '1.1rem' }}>{editingDJ ? 'Edit artist' : 'Add artist'}</h2>
              <button onClick={closeModal} className="btn btn-ghost btn-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'grid', gap: '0.75rem' }}>
              <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: '1fr 1fr' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem', display: 'block', color: 'var(--muted)' }}>Name</label>
                  <input type="text" {...register("dj_name", { required: true })} className="input" />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem', display: 'block', color: 'var(--muted)' }}>Email</label>
                  <input type="email" {...register("email", { required: true })} className="input" />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem', display: 'block', color: 'var(--muted)' }}>City</label>
                  <input type="text" {...register("city")} className="input" />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem', display: 'block', color: 'var(--muted)' }}>Phone</label>
                  <input type="text" {...register("phone")} className="input" />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem', display: 'block', color: 'var(--muted)' }}>Genres</label>
                <input type="text" {...register("genres")} className="input" placeholder="e.g. Techno, House, Trad" />
              </div>
              <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: '1fr 1fr' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem', display: 'block', color: 'var(--muted)' }}>Instagram</label>
                  <input type="text" {...register("instagram")} className="input" />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem', display: 'block', color: 'var(--muted)' }}>SoundCloud</label>
                  <input type="text" {...register("soundcloud")} className="input" />
                </div>
              </div>
              <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: '1fr 1fr' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem', display: 'block', color: 'var(--muted)' }}>Currency</label>
                  <select {...register("currency")} className="input">
                    <option value="EUR">EUR</option>
                    <option value="GBP">GBP</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, marginBottom: '0.3rem', display: 'block', color: 'var(--muted)' }}>Fee</label>
                  <input type="number" step="0.01" {...register("numeric_fee")} className="input" />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" onClick={closeModal} className="btn btn-outline btn-sm">Cancel</button>
                <button type="submit" className="btn btn-primary btn-sm">{editingDJ ? 'Update' : 'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DJs;
