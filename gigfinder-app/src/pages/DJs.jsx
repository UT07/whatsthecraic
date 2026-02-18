import React, { useState, useEffect, useMemo, useRef } from 'react';
import djAPI from '../services/djAPI';
import eventsAPI from '../services/eventsAPI';
import { getUser } from '../services/apiClient';
import authAPI from '../services/authAPI';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { fetchArtistImage } from '../utils/imageUtils';

const normalizeToken = (value) => (value ?? '').toString().toLowerCase().trim();

const splitGenres = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(item => normalizeToken(item)).filter(Boolean);
  }
  return value
    .toString()
    .split(/[,/|]+/)
    .map(item => normalizeToken(item))
    .filter(Boolean);
};

const computeArtistRelevance = (artist, spotifyProfile, soundcloudProfile, filters) => {
  const spotifyArtists = (spotifyProfile?.top_artists || [])
    .map(item => normalizeToken(typeof item === 'string' ? item : item?.name))
    .filter(Boolean);
  const spotifyGenres = (spotifyProfile?.top_genres || [])
    .map(item => normalizeToken(typeof item === 'string' ? item : item?.genre))
    .filter(Boolean);
  const soundcloudArtists = (soundcloudProfile?.top_artists || [])
    .map(item => normalizeToken(typeof item === 'string' ? item : item?.name))
    .filter(Boolean);
  const soundcloudGenres = (soundcloudProfile?.top_genres || [])
    .map(item => normalizeToken(typeof item === 'string' ? item : item?.genre))
    .filter(Boolean);
  const spotifyGenreSet = new Set(spotifyGenres);
  const soundcloudGenreSet = new Set(soundcloudGenres);

  let raw = 0;
  const reasons = [];
  const artistName = normalizeToken(artist.name);

  const artistMatches = spotifyArtists.filter(token =>
    token && (artistName.includes(token) || token.includes(artistName))
  );
  if (artistMatches.length > 0) {
    raw += Math.min(artistMatches.length, 3) * 4;
    reasons.push('spotify artist');
  }
  const soundcloudArtistMatches = soundcloudArtists.filter(token =>
    token && (artistName.includes(token) || token.includes(artistName))
  );
  if (soundcloudArtistMatches.length > 0) {
    raw += Math.min(soundcloudArtistMatches.length, 3) * 4;
    reasons.push('soundcloud artist');
  }

  const genreMatches = (artist.genre_tokens || []).filter(token => spotifyGenreSet.has(token));
  if (genreMatches.length > 0) {
    raw += Math.min(genreMatches.length, 4) * 2;
    reasons.push('genre match');
  }
  const soundcloudGenreMatches = (artist.genre_tokens || []).filter(token => soundcloudGenreSet.has(token));
  if (soundcloudGenreMatches.length > 0) {
    raw += Math.min(soundcloudGenreMatches.length, 4) * 2;
    reasons.push('soundcloud genre');
  }

  const qToken = normalizeToken(filters.q);
  if (qToken && artistName.includes(qToken)) {
    raw += 1;
    reasons.push('query match');
  }

  const normalized = raw > 0 ? (1 - Math.exp(-raw / 6)) : 0;
  return {
    relevance_score: Number(normalized.toFixed(3)),
    relevance_score_raw: Number(raw.toFixed(3)),
    relevance_reasons: reasons
  };
};

const DJs = () => {
  const user = getUser();
  const isAdmin = user?.role === 'admin';
  const [djs, setDjs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDJ, setEditingDJ] = useState(null);
  const [performers, setPerformers] = useState([]);
  const [performersLoading, setPerformersLoading] = useState(false);
  const [spotifyProfile, setSpotifyProfile] = useState(null);
  const [soundcloudProfile, setSoundcloudProfile] = useState(null);
  const [localOnly, setLocalOnly] = useState(false);

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

  const loadPerformers = async (activeFilters = filters, localOnlyOverride = localOnly) => {
    setPerformersLoading(true);
    try {
      const data = await eventsAPI.getPerformers({
        city: activeFilters.city || undefined,
        q: activeFilters.q || undefined,
        include: localOnlyOverride ? 'local' : 'local,ticketmaster,spotify,mixcloud,soundcloud',
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchDJs(); }, []);

  useEffect(() => {
    Promise.all([
      authAPI.getSpotifyProfile().catch(() => null),
      authAPI.getSoundCloudProfile().catch(() => null)
    ]).then(([spotify, soundcloud]) => {
      setSpotifyProfile(spotify);
      setSoundcloudProfile(soundcloud);
    });
  }, []);

  useEffect(() => {
    loadPerformers(filters, localOnly);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localOnly]);

  const runSearch = async () => {
    setSearching(true);
    await Promise.all([
      fetchDJs(true),
      loadPerformers(filters, localOnly)
    ]);
    setSearching(false);
  };

  const resetSearch = async () => {
    const resetState = { q: '', city: '', genres: '', feeMax: '' };
    setFilters(resetState);
    await Promise.all([
      fetchDJs(false),
      loadPerformers(resetState, localOnly)
    ]);
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

  const unifiedArtists = useMemo(() => {
    const byName = new Map();

    const upsert = (incoming) => {
      const key = normalizeToken(incoming.name);
      if (!key) return;

      const incomingGenres = splitGenres(incoming.genres);
      if (!byName.has(key)) {
        byName.set(key, {
          ...incoming,
          sources: [incoming.source].filter(Boolean),
          genre_tokens: incomingGenres
        });
        return;
      }

      const existing = byName.get(key);
      const sourceSet = new Set([...(existing.sources || []), incoming.source].filter(Boolean));
      const genreSet = new Set([...(existing.genre_tokens || []), ...incomingGenres]);

      byName.set(key, {
        ...existing,
        image: existing.image || incoming.image || null,
        city: existing.city || incoming.city || null,
        genres: existing.genres || incoming.genres || null,
        genre_tokens: Array.from(genreSet),
        sources: Array.from(sourceSet),
        popularity: Math.max(Number(existing.popularity || 0), Number(incoming.popularity || 0)) || null,
        spotifyUrl: existing.spotifyUrl || incoming.spotifyUrl || null,
        mixcloudUrl: existing.mixcloudUrl || incoming.mixcloudUrl || null,
        instagram: existing.instagram || incoming.instagram || null,
        soundcloud: existing.soundcloud || incoming.soundcloud || null,
        localDj: existing.localDj || incoming.localDj || null,
        fee: existing.fee ?? incoming.fee ?? null,
        currency: existing.currency || incoming.currency || null
      });
    };

    djs.forEach((dj) => {
      upsert({
        name: dj.dj_name,
        source: 'local',
        city: dj.city || null,
        genres: dj.genres || null,
        instagram: dj.instagram || null,
        soundcloud: dj.soundcloud || null,
        fee: dj.numeric_fee === null || dj.numeric_fee === undefined ? null : Number(dj.numeric_fee),
        currency: dj.currency || 'EUR',
        localDj: dj,
        image: null
      });
    });

    performers.forEach((performer) => {
      upsert({
        ...performer,
        source: performer.source || 'external',
        name: performer.name,
        city: performer.city || null,
        genres: performer.genres || null,
        image: performer.image || null
      });
    });

    const qToken = normalizeToken(filters.q);
    const cityToken = normalizeToken(filters.city);
    const genreToken = normalizeToken(filters.genres);
    const feeMax = Number(filters.feeMax);

    return Array.from(byName.values())
      .filter((artist) => {
        if (localOnly) {
          const sourceSet = new Set((artist.sources || []).map((source) => normalizeToken(source)));
          if (![...sourceSet].every((source) => source === 'local')) return false;
        }
        if (qToken && !normalizeToken(artist.name).includes(qToken)) return false;
        if (cityToken) {
          const cityMatches = normalizeToken(artist.city).includes(cityToken);
          const sourceSet = new Set((artist.sources || []).map((source) => normalizeToken(source)));
          const isGlobalArtist = sourceSet.has('mixcloud') || sourceSet.has('soundcloud') || sourceSet.has('spotify');
          if (!cityMatches && !isGlobalArtist) return false;
        }
        if (genreToken) {
          const hasGenreMatch = (artist.genre_tokens || []).some(token => token.includes(genreToken));
          if (!hasGenreMatch) return false;
        }
        if (!Number.isNaN(feeMax) && feeMax > 0) {
          const fee = Number(artist.fee);
          if (!Number.isNaN(fee) && fee > feeMax) return false;
        }
        return true;
      })
      .map((artist) => ({
        ...artist,
        ...computeArtistRelevance(artist, spotifyProfile, soundcloudProfile, filters)
      }))
      .sort((a, b) => {
        if (b.relevance_score !== a.relevance_score) return b.relevance_score - a.relevance_score;
        const popA = Number(a.popularity || 0);
        const popB = Number(b.popularity || 0);
        if (popB !== popA) return popB - popA;
        if ((b.sources || []).length !== (a.sources || []).length) {
          return (b.sources || []).length - (a.sources || []).length;
        }
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [djs, performers, spotifyProfile, soundcloudProfile, filters, localOnly]);

  const UnifiedArtistCard = ({ artist, index }) => {
    const [artistImage, setArtistImage] = useState(artist.image || null);
    const [loadingImage, setLoadingImage] = useState(false);
    const [isInView, setIsInView] = useState(Boolean(artist.image));
    const cardRef = useRef(null);

    useEffect(() => {
      if (isInView) return;
      const node = cardRef.current;
      if (!node || typeof IntersectionObserver === 'undefined') {
        setIsInView(true);
        return;
      }
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            setIsInView(true);
            observer.disconnect();
          }
        },
        { rootMargin: '240px 0px' }
      );
      observer.observe(node);
      return () => observer.disconnect();
    }, [isInView]);

    useEffect(() => {
      const loadImage = async () => {
        if (!isInView || artistImage || loadingImage || !artist.name) return;
        setLoadingImage(true);
        const image = await fetchArtistImage(artist.name, { soundcloudUrl: artist.soundcloud });
        if (image) setArtistImage(image);
        setLoadingImage(false);
      };
      loadImage();
    }, [artist.name, artist.soundcloud, artistImage, loadingImage, isInView]);

    return (
      <motion.div
        ref={cardRef}
        key={`${artist.name}-${index}`}
        className="card-artist"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: index * 0.02 }}
      >
        <div className="card-artist-img-wrap" style={{ paddingTop: '100%' }}>
          {artistImage ? (
            <img src={artistImage} alt={artist.name} className="card-artist-img" loading="lazy" decoding="async" />
          ) : (
            <div style={{
              position: 'absolute', inset: 0,
              background: `linear-gradient(135deg, hsl(${(index * 53) % 360}, 35%, 16%), hsl(${(index * 89) % 360}, 25%, 10%))`,
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <span style={{ fontSize: '3rem', fontWeight: 800, color: 'rgba(255,255,255,0.12)' }}>
                {(artist.name || '?')[0].toUpperCase()}
              </span>
            </div>
          )}
          {artist.relevance_score > 0 && (
            <div style={{
              position: 'absolute',
              top: 8,
              left: 8,
              zIndex: 3,
              padding: '0.25rem 0.5rem',
              borderRadius: 8,
              background: 'rgba(0,0,0,0.65)',
              color: artist.relevance_score > 0.7 ? 'var(--emerald)' : artist.relevance_score > 0.4 ? 'var(--gold)' : 'var(--muted)',
              fontSize: '0.66rem',
              fontWeight: 800
            }}>
              {Math.round(artist.relevance_score * 100)}% match
            </div>
          )}
        </div>
        <div className="card-artist-body">
          <h3 className="line-clamp-1" style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.3rem' }}>
            {artist.name}
          </h3>
          <p className="line-clamp-2" style={{ fontSize: '0.78rem', color: 'var(--muted)', marginBottom: '0.5rem', minHeight: '2.4rem' }}>
            {artist.genres || 'Genre unavailable'}
          </p>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.55rem' }}>
            {(artist.sources || []).map(source => (
              <span key={source} className="chip" style={{ fontSize: '0.64rem', padding: '0.2rem 0.45rem' }}>
                {source}
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {artist.spotifyUrl && (
              <a href={artist.spotifyUrl} target="_blank" rel="noopener noreferrer"
                className="chip"
                style={{ fontSize: '0.65rem', padding: '0.2rem 0.45rem', background: 'rgba(29,185,84,0.15)', borderColor: '#1DB954', color: '#1DB954', textDecoration: 'none' }}>
                Spotify ↗
              </a>
            )}
            {artist.mixcloudUrl && (
              <a href={artist.mixcloudUrl} target="_blank" rel="noopener noreferrer"
                className="chip"
                style={{ fontSize: '0.65rem', padding: '0.2rem 0.45rem', background: 'rgba(82,177,252,0.15)', borderColor: '#52B1FC', color: '#52B1FC', textDecoration: 'none' }}>
                Mixcloud ↗
              </a>
            )}
            {artist.soundcloud && (
              <a href={artist.soundcloud} target="_blank" rel="noopener noreferrer"
                className="chip"
                style={{ fontSize: '0.65rem', padding: '0.2rem 0.45rem', background: 'rgba(255,140,66,0.15)', borderColor: '#ff8c42', color: '#ff8c42', textDecoration: 'none' }}>
                SoundCloud ↗
              </a>
            )}
            {artist.localDj && isAdmin && (
              <>
                <button onClick={() => openModal(artist.localDj)} className="btn btn-outline btn-sm" style={{ fontSize: '0.72rem' }}>Edit</button>
                <button onClick={() => handleDeleteDJ(artist.localDj.dj_id)} className="btn btn-ghost btn-sm" style={{ fontSize: '0.72rem' }}>Delete</button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem' }}>
        <div>
          <button
            type="button"
            className="badge"
            onClick={() => setLocalOnly((value) => !value)}
            style={{
              marginBottom: '0.5rem',
              border: 'none',
              cursor: 'pointer',
              background: localOnly ? 'linear-gradient(90deg, rgba(0,214,125,0.25), rgba(0,214,125,0.12))' : undefined
            }}
          >
            {localOnly ? 'Local Irish Selection: ON' : 'Local Irish Selection'}
          </button>
          <h1 className="section-title" style={{ marginBottom: '0.3rem' }}>Artists & DJs</h1>
          <p className="section-subtitle">
            {localOnly
              ? 'Showing only local DB artists from Ireland.'
              : 'Unified artists across local DB + external APIs, ranked by your Spotify + SoundCloud taste'}
          </p>
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

      <section>
        {(loading || performersLoading) ? (
          <div className="grid-events">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="skeleton" style={{ height: 320, borderRadius: 14 }} />
            ))}
          </div>
        ) : unifiedArtists.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <p style={{ fontWeight: 700, fontSize: '1.05rem', marginBottom: '0.3rem' }}>No artists found</p>
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
              Try adjusting search filters or refresh discovery sources.
            </p>
            <button className="btn btn-primary btn-sm" onClick={loadPerformers}>Refresh sources</button>
          </div>
        ) : (
          <div className="grid-events" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
            {unifiedArtists.map((artist, index) => (
              <UnifiedArtistCard key={`${artist.name}-${index}`} artist={artist} index={index} />
            ))}
          </div>
        )}
      </section>

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
