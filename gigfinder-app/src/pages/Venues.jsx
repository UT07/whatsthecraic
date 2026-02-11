// src/pages/Venues.jsx
import React, { useState, useEffect } from 'react';
import venueAPI from '../services/venueAPI';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';

const Venues = () => {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState(null);
  const [filters, setFilters] = useState({
    q: '',
    city: '',
    genreFocus: '',
    capacityMin: '',
    capacityMax: ''
  });
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [availabilityVenue, setAvailabilityVenue] = useState(null);
  const [availabilityItems, setAvailabilityItems] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityForm, setAvailabilityForm] = useState({
    start_time: '',
    end_time: '',
    status: 'available',
    notes: ''
  });

  const { register, handleSubmit, reset } = useForm();

  const fetchVenues = (useSearch = false) => {
    const request = useSearch ? venueAPI.searchVenues(filters) : venueAPI.getAllVenues();
    request
      .then((data) => {
        setVenues(useSearch ? (data.venues || []) : data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching venues:", error);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchVenues();
  }, []);

  const runSearch = async () => {
    setSearching(true);
    setLoading(true);
    await fetchVenues(true);
    setSearching(false);
  };

  const resetSearch = async () => {
    setFilters({ q: '', city: '', genreFocus: '', capacityMin: '', capacityMax: '' });
    setLoading(true);
    await fetchVenues(false);
  };

  const openModal = (venue = null) => {
    setEditingVenue(venue);
    reset(venue || {});
    setModalOpen(true);
  };

  const openAvailability = async (venue) => {
    setAvailabilityVenue(venue);
    setAvailabilityOpen(true);
    setAvailabilityLoading(true);
    try {
      const data = await venueAPI.getAvailability(venue.id);
      setAvailabilityItems(data.availability || []);
    } catch (error) {
      console.error('Error loading availability:', error);
      setAvailabilityItems([]);
    } finally {
      setAvailabilityLoading(false);
    }
  };

  const closeAvailability = () => {
    setAvailabilityOpen(false);
    setAvailabilityVenue(null);
    setAvailabilityItems([]);
    setAvailabilityForm({ start_time: '', end_time: '', status: 'available', notes: '' });
  };

  const addAvailability = async () => {
    if (!availabilityVenue) return;
    try {
      const payload = {
        start_time: availabilityForm.start_time,
        end_time: availabilityForm.end_time,
        status: availabilityForm.status,
        notes: availabilityForm.notes
      };
      const response = await venueAPI.addAvailability(availabilityVenue.id, payload);
      setAvailabilityItems(prev => [...prev, response.availability]);
      setAvailabilityForm({ start_time: '', end_time: '', status: 'available', notes: '' });
    } catch (error) {
      console.error('Error adding availability:', error);
      alert('Failed to add availability');
    }
  };

  const deleteAvailability = async (availabilityId) => {
    if (!availabilityVenue) return;
    try {
      await venueAPI.deleteAvailability(availabilityVenue.id, availabilityId);
      setAvailabilityItems(prev => prev.filter(item => item.id !== availabilityId));
    } catch (error) {
      console.error('Error deleting availability:', error);
      alert('Failed to delete availability');
    }
  };

  const closeModal = () => {
    setEditingVenue(null);
    setModalOpen(false);
  };

  const onSubmit = (formData) => {
    if (editingVenue) {
      venueAPI.updateVenue(editingVenue.id, formData)
        .then(() => {
          alert("Venue updated successfully");
          fetchVenues();
          closeModal();
        })
        .catch(error => {
          console.error("Error updating venue:", error);
          alert("Failed to update venue");
        });
    } else {
      venueAPI.addVenue(formData)
        .then(() => {
          alert("Venue added successfully");
          fetchVenues();
          closeModal();
        })
        .catch(error => {
          console.error("Error adding venue:", error);
          alert("Failed to add venue");
        });
    }
  };

  const handleDeleteVenue = (venueId) => {
    if (window.confirm("Are you sure you want to delete this venue?")) {
      venueAPI.deleteVenue(venueId)
        .then(() => {
          alert("Venue deleted successfully");
          fetchVenues();
        })
        .catch(error => {
          console.error("Error deleting venue:", error);
          alert("Failed to delete venue");
        });
    }
  };

  if (loading) {
    return (
      <div className="card max-w-md mx-auto text-center">
        <p className="text-muted">Loading venues...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="badge mb-2">Marketplace</div>
          <h1 className="section-title">Venue scouting</h1>
          <p className="section-subtitle">Compare capacity, equipment, and fit per genre.</p>
        </div>
        <button onClick={() => openModal()} className="btn btn-primary">Add Venue</button>
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
          placeholder="Genre focus"
          value={filters.genreFocus}
          onChange={(e) => setFilters({ ...filters, genreFocus: e.target.value })}
        />
        <input
          className="input"
          type="number"
          placeholder="Min capacity"
          value={filters.capacityMin}
          onChange={(e) => setFilters({ ...filters, capacityMin: e.target.value })}
        />
        <input
          className="input"
          type="number"
          placeholder="Max capacity"
          value={filters.capacityMax}
          onChange={(e) => setFilters({ ...filters, capacityMax: e.target.value })}
        />
        <div className="flex flex-wrap gap-2 md:col-span-4">
          <button className="btn btn-primary" onClick={runSearch} disabled={searching}>
            {searching ? 'Searching…' : 'Search venues'}
          </button>
          <button className="btn btn-outline" onClick={resetSearch}>Reset</button>
        </div>
      </div>

      <div className="grid-auto">
        {venues.map(venue => (
          <motion.div
            key={venue.id}
            className="card flex flex-col gap-2"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{venue.name}</h2>
              <span className="chip">{venue.capacity ? `${venue.capacity} cap` : 'Capacity TBA'}</span>
            </div>
            <p className="text-muted text-sm">{venue.address || 'Address pending'}</p>
            <div className="grid gap-1 text-sm">
              <span>Genre focus: {venue.genreFocus || '—'}</span>
              <span>Latitude: {venue.latitude || '—'}</span>
              <span>Longitude: {venue.longitude || '—'}</span>
            </div>
            <p className="text-muted text-sm">{venue.notes || 'No notes yet.'}</p>
            <div className="flex gap-2 mt-3">
              <button onClick={() => openModal(venue)} className="btn btn-outline">Edit</button>
              <button onClick={() => openAvailability(venue)} className="btn btn-outline">Availability</button>
              <button onClick={() => handleDeleteVenue(venue.id)} className="btn btn-ghost">Delete</button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Modal for Add/Edit Venue */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="glass p-6 w-11/12 max-w-md relative">
            <h2 className="section-title mb-4">{editingVenue ? 'Edit Venue' : 'Add Venue'}</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block mb-1 text-sm font-semibold">Name</label>
                <input type="text" {...register("name", { required: true })} className="input" />
              </div>
              <div>
                <label className="block mb-1 text-sm font-semibold">Address</label>
                <input type="text" {...register("address", { required: true })} className="input" />
              </div>
              <div>
                <label className="block mb-1 text-sm font-semibold">Capacity</label>
                <input type="number" {...register("capacity")} className="input" />
              </div>
              <div>
                <label className="block mb-1 text-sm font-semibold">Genre Focus</label>
                <input type="text" {...register("genreFocus")} className="input" />
              </div>
              <div>
                <label className="block mb-1 text-sm font-semibold">Latitude</label>
                <input type="number" step="0.000001" {...register("latitude")} className="input" />
              </div>
              <div>
                <label className="block mb-1 text-sm font-semibold">Longitude</label>
                <input type="number" step="0.000001" {...register("longitude")} className="input" />
              </div>
              <div>
                <label className="block mb-1 text-sm font-semibold">Notes</label>
                <textarea {...register("notes")} className="input" rows="3" />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={closeModal} className="btn btn-outline">Cancel</button>
                <button type="submit" className="btn btn-primary">{editingVenue ? 'Update' : 'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {availabilityOpen && availabilityVenue && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="glass p-6 w-11/12 max-w-2xl relative space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="section-title">Availability · {availabilityVenue.name}</h2>
              <button className="btn btn-ghost" onClick={closeAvailability}>Close</button>
            </div>
            <div className="grid gap-3 md:grid-cols-4">
              <input
                className="input"
                type="datetime-local"
                value={availabilityForm.start_time}
                onChange={(e) => setAvailabilityForm({ ...availabilityForm, start_time: e.target.value })}
              />
              <input
                className="input"
                type="datetime-local"
                value={availabilityForm.end_time}
                onChange={(e) => setAvailabilityForm({ ...availabilityForm, end_time: e.target.value })}
              />
              <select
                className="input"
                value={availabilityForm.status}
                onChange={(e) => setAvailabilityForm({ ...availabilityForm, status: e.target.value })}
              >
                <option value="available">Available</option>
                <option value="hold">Hold</option>
                <option value="booked">Booked</option>
              </select>
              <input
                className="input"
                placeholder="Notes"
                value={availabilityForm.notes}
                onChange={(e) => setAvailabilityForm({ ...availabilityForm, notes: e.target.value })}
              />
              <div className="md:col-span-4">
                <button className="btn btn-primary" onClick={addAvailability}>Add window</button>
              </div>
            </div>
            {availabilityLoading ? (
              <div className="card text-center text-muted">Loading availability…</div>
            ) : availabilityItems.length === 0 ? (
              <div className="card text-center text-muted">No availability windows yet.</div>
            ) : (
              <div className="grid gap-2">
                {availabilityItems.map(item => (
                  <div key={item.id} className="card flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold">{item.status}</div>
                      <div className="text-xs text-muted">
                        {item.start_time} → {item.end_time}
                      </div>
                      {item.notes && <div className="text-xs text-muted">{item.notes}</div>}
                    </div>
                    <button className="btn btn-ghost" onClick={() => deleteAvailability(item.id)}>Delete</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Venues;
