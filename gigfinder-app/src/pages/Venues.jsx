// src/pages/Venues.jsx
import React, { useState, useEffect } from 'react';
import venueAPI from '../services/venueAPI';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';

const Venues = () => {
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState(null);

  const { register, handleSubmit, reset } = useForm();

  const fetchVenues = () => {
    venueAPI.getAllVenues()
      .then((data) => {
        setVenues(data);
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

  const openModal = (venue = null) => {
    setEditingVenue(venue);
    reset(venue || {});
    setModalOpen(true);
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
    </div>
  );
};

export default Venues;
