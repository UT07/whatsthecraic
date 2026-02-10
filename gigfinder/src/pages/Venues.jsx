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

  if (loading) return <p className="text-green-400">Loading Venues...</p>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl">Venues</h1>
        <button 
          onClick={() => openModal()} 
          className="bg-green-500 px-4 py-2 rounded hover:bg-green-600"
        >
          Add Venue
        </button>
      </div>

      {/* Two-column responsive grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {venues.map(venue => (
          <motion.div
            key={venue.id}
            className="bg-gray-800 p-4 rounded transform transition-all duration-300 hover:scale-105 flex flex-col"
          >
            <h2 className="text-xl mb-2">{venue.name}</h2>
            <p><strong>Address:</strong> {venue.address}</p>
            <p><strong>Capacity:</strong> {venue.capacity}</p>
            <p><strong>Genre Focus:</strong> {venue.genreFocus}</p>
            <p><strong>Latitude:</strong> {venue.latitude}</p>
            <p><strong>Longitude:</strong> {venue.longitude}</p>
            <p><strong>Notes:</strong> {venue.notes}</p>

            <div className="flex space-x-2 mt-2">
              <button 
                onClick={() => openModal(venue)}
                className="bg-blue-500 px-3 py-1 rounded hover:bg-blue-600"
              >
                Edit
              </button>
              <button 
                onClick={() => handleDeleteVenue(venue.id)}
                className="bg-red-500 px-3 py-1 rounded hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Modal for Add/Edit Venue */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 p-6 rounded w-11/12 max-w-md relative">
            <h2 className="text-2xl mb-4">{editingVenue ? 'Edit Venue' : 'Add Venue'}</h2>
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="mb-4">
                <label className="block mb-1">Name</label>
                <input type="text" {...register("name", { required: true })} className="w-full p-2 rounded bg-gray-800" />
              </div>
              <div className="mb-4">
                <label className="block mb-1">Address</label>
                <input type="text" {...register("address", { required: true })} className="w-full p-2 rounded bg-gray-800" />
              </div>
              <div className="mb-4">
                <label className="block mb-1">Capacity</label>
                <input type="number" {...register("capacity")} className="w-full p-2 rounded bg-gray-800" />
              </div>
              <div className="mb-4">
                <label className="block mb-1">Genre Focus</label>
                <input type="text" {...register("genreFocus")} className="w-full p-2 rounded bg-gray-800" />
              </div>
              <div className="mb-4">
                <label className="block mb-1">Latitude</label>
                <input type="number" step="0.000001" {...register("latitude")} className="w-full p-2 rounded bg-gray-800" />
              </div>
              <div className="mb-4">
                <label className="block mb-1">Longitude</label>
                <input type="number" step="0.000001" {...register("longitude")} className="w-full p-2 rounded bg-gray-800" />
              </div>
              <div className="mb-4">
                <label className="block mb-1">Notes</label>
                <textarea {...register("notes")} className="w-full p-2 rounded bg-gray-800" rows="3" />
              </div>
              <div className="flex justify-end space-x-2">
                <button type="button" onClick={closeModal} className="bg-gray-500 px-4 py-2 rounded hover:bg-gray-600">Cancel</button>
                <button type="submit" className="bg-green-500 px-4 py-2 rounded hover:bg-green-600">{editingVenue ? 'Update' : 'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Venues;