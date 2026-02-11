import React, { useState, useEffect } from 'react';
import djAPI from '../services/djAPI';
import eventsAPI from '../services/eventsAPI';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';

const DJs = () => {
  const [djs, setDjs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDJ, setEditingDJ] = useState(null);
  const [performers, setPerformers] = useState([]);
  const [performersLoading, setPerformersLoading] = useState(false);

  const [filters, setFilters] = useState({
    q: '',
    city: '',
    genres: '',
    feeMax: ''
  });

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

  useEffect(() => {
    fetchDJs();
  }, []);

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
        include: 'ticketmaster,spotify',
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
    reset(dj || {}); // Pre-fill the form if editing
    setModalOpen(true);
  };

  const closeModal = () => {
    setEditingDJ(null);
    setModalOpen(false);
  };

  const onSubmit = async (formData) => {
    try {
      if (editingDJ) {
        // Update DJ
        await djAPI.updateDJ(editingDJ.dj_id, formData);
        alert("DJ updated successfully");
      } else {
        // Add new DJ
        await djAPI.addDJ(formData);
        alert("DJ added successfully");
      }
      fetchDJs();
      closeModal();
    } catch (error) {
      console.error("Error adding/updating DJ:", error);
      alert("Failed to add/update DJ");
    }
  };

  const handleDeleteDJ = async (djId) => {
    if (window.confirm("Are you sure you want to delete this DJ?")) {
      try {
        await djAPI.deleteDJ(djId);
        alert("DJ deleted successfully");
        fetchDJs();
      } catch (error) {
        console.error("Error deleting DJ:", error);
        alert("Failed to delete DJ");
      }
    }
  };

  if (loading) {
    return (
      <div className="card max-w-md mx-auto text-center">
        <p className="text-muted">Loading DJs...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="badge mb-2">Marketplace</div>
          <h1 className="section-title">DJ roster</h1>
          <p className="section-subtitle">Shortlist talent, compare fees, and reach out in minutes.</p>
        </div>
        <button onClick={() => openModal()} className="btn btn-primary">
          Add DJ
        </button>
      </div>

      <div className="card grid gap-4 md:grid-cols-4">
        <input
          className="input"
          placeholder="Search name"
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
        />
        <input
          className="input"
          placeholder="City"
          value={filters.city}
          onChange={(e) => setFilters({ ...filters, city: e.target.value })}
        />
        <input
          className="input"
          placeholder="Genres"
          value={filters.genres}
          onChange={(e) => setFilters({ ...filters, genres: e.target.value })}
        />
        <input
          className="input"
          type="number"
          placeholder="Max fee"
          value={filters.feeMax}
          onChange={(e) => setFilters({ ...filters, feeMax: e.target.value })}
        />
        <div className="flex flex-wrap gap-2 md:col-span-4">
          <button className="btn btn-primary" onClick={runSearch} disabled={searching}>
            {searching ? 'Searching…' : 'Search DJs'}
          </button>
          <button className="btn btn-outline" onClick={resetSearch}>Reset</button>
          <button className="btn btn-ghost" onClick={loadPerformers} disabled={performersLoading}>
            {performersLoading ? 'Loading…' : 'Load Spotify/Ticketmaster performers'}
          </button>
        </div>
      </div>

      <div className="grid-auto">
        {djs.map(dj => (
          <motion.div
            key={dj.dj_id}
            className="card flex flex-col gap-2"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{dj.dj_name}</h2>
              <span className="chip">{dj.city || 'City TBA'}</span>
            </div>
            <p className="text-muted text-sm">{dj.genres || 'Genres pending'}</p>
            <div className="grid gap-1 text-sm">
              <span>Email: {dj.email}</span>
              <span>Instagram: {dj.instagram || '—'}</span>
              <span>SoundCloud: {dj.soundcloud || '—'}</span>
              <span>Phone: {dj.phone || '—'}</span>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <span className="badge">Fee {dj.currency || 'EUR'} {dj.numeric_fee || 'TBD'}</span>
              <span className="chip">EUR {dj.fee_eur || 'TBD'}</span>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => openModal(dj)} className="btn btn-outline">Edit</button>
              <button onClick={() => handleDeleteDJ(dj.dj_id)} className="btn btn-ghost">Delete</button>
            </div>
          </motion.div>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="section-title text-base">Discovered performers</h2>
        {performersLoading ? (
          <div className="card text-center text-muted">Loading performers…</div>
        ) : performers.length === 0 ? (
          <div className="card text-center text-muted">No additional performers yet.</div>
        ) : (
          <div className="grid-auto">
            {performers.map((performer, index) => (
              <motion.div
                key={`${performer.name}-${index}`}
                className="card flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold">{performer.name}</h3>
                  <span className="chip">{performer.source}</span>
                </div>
                {performer.genres && (
                  <p className="text-muted text-sm">
                    {Array.isArray(performer.genres) ? performer.genres.join(', ') : performer.genres}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="glass p-6 w-11/12 max-w-md relative">
            <h2 className="section-title mb-4">{editingDJ ? 'Edit DJ' : 'Add DJ'}</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block mb-1 text-sm font-semibold">Name</label>
                <input type="text" {...register("dj_name", { required: true })} className="input" />
              </div>
              <div>
                <label className="block mb-1 text-sm font-semibold">Email</label>
                <input type="email" {...register("email", { required: true })} className="input" />
              </div>
              <div>
                <label className="block mb-1 text-sm font-semibold">Instagram</label>
                <input type="text" {...register("instagram")} className="input" />
              </div>
              <div>
                <label className="block mb-1 text-sm font-semibold">Genres</label>
                <input type="text" {...register("genres")} className="input" />
              </div>
              <div>
                <label className="block mb-1 text-sm font-semibold">SoundCloud</label>
                <textarea {...register("soundcloud")} className="input" rows="2" />
              </div>
              <div>
                <label className="block mb-1 text-sm font-semibold">City</label>
                <input type="text" {...register("city")} className="input" />
              </div>
              <div>
                <label className="block mb-1 text-sm font-semibold">Phone</label>
                <input type="text" {...register("phone")} className="input" />
              </div>
              <div>
                <label className="block mb-1 text-sm font-semibold">Currency</label>
                <select {...register("currency")} className="input">
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="INR">INR</option>
                  <option value="GBP">GBP</option>
                  <option value="CNY">CNY</option>
                </select>
              </div>
              <div>
                <label className="block mb-1 text-sm font-semibold">DJ Fee</label>
                <input type="number" step="0.01" {...register("numeric_fee")} className="input" />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={closeModal} className="btn btn-outline">Cancel</button>
                <button type="submit" className="btn btn-primary">{editingDJ ? 'Update' : 'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DJs;
