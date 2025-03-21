// src/pages/CombinedGigs.jsx
import React, { useState, useEffect } from 'react';
import eventsAPI from '../services/eventsAPI';
import aggregatorAPI from '../services/aggregatorAPI';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';

const CombinedGigs = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [filters, setFilters] = useState({
    city: '',
    genre: '',
    djName: '',
    venueName: ''
  });

  const { register, handleSubmit, reset } = useForm();

  const fetchEvents = () => {
    eventsAPI.getAllEvents()
      .then((data) => {
        setEvents(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching events:", error);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const openModal = (event = null) => {
    setEditingEvent(event);
    reset(event || {}); // Pre-fill form if editing
    setModalOpen(true);
  };

  const closeModal = () => {
    setEditingEvent(null);
    setModalOpen(false);
  };

  const onSubmit = (formData) => {
    if (editingEvent) {
      eventsAPI.updateEvent(editingEvent.id, formData)
        .then(() => {
          alert("Event updated successfully");
          fetchEvents();
          closeModal();
        })
        .catch(error => {
          console.error("Error updating event:", error);
          alert("Failed to update event");
        });
    } else {
      eventsAPI.addEvent(formData)
        .then(() => {
          alert("Event added successfully");
          fetchEvents();
          closeModal();
        })
        .catch(error => {
          console.error("Error adding event:", error);
          alert("Failed to add event");
        });
    }
  };

  const handleDeleteEvent = (eventId) => {
    if (window.confirm("Are you sure you want to delete this event?")) {
      eventsAPI.deleteEvent(eventId)
        .then(() => {
          alert("Event deleted successfully");
          fetchEvents();
        })
        .catch((error) => {
          console.error("Error deleting event:", error);
          alert("Failed to delete event");
        });
    }
  };

  const handleSearch = () => {
    setLoading(true);
    aggregatorAPI.searchEvents(filters)
      .then((data) => {
        setEvents(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error searching events:", error);
        setLoading(false);
      });
  };

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl mb-4">Events</h1>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <input
            type="text"
            name="city"
            placeholder="City"
            className="p-2 rounded bg-gray-800"
            value={filters.city}
            onChange={(e) => setFilters({ ...filters, city: e.target.value })}
          />
          <input
            type="text"
            name="genre"
            placeholder="Genre"
            className="p-2 rounded bg-gray-800"
            value={filters.genre}
            onChange={(e) => setFilters({ ...filters, genre: e.target.value })}
          />
          <input
            type="text"
            name="djName"
            placeholder="DJ Name"
            className="p-2 rounded bg-gray-800"
            value={filters.djName}
            onChange={(e) => setFilters({ ...filters, djName: e.target.value })}
          />
          <input
            type="text"
            name="venueName"
            placeholder="Venue Name"
            className="p-2 rounded bg-gray-800"
            value={filters.venueName}
            onChange={(e) => setFilters({ ...filters, venueName: e.target.value })}
          />
        </div>
        <div className="flex space-x-4 mb-4">
          <button 
            onClick={handleSearch} 
            className="bg-green-500 px-4 py-2 rounded hover:bg-green-600"
          >
            Search
          </button>
          <button 
            onClick={() => openModal()} 
            className="bg-green-500 px-4 py-2 rounded hover:bg-green-600"
          >
            Add Event
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-green-400">Loading events...</p>
      ) : (
        // Two-column responsive grid
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {events.map(event => (
            <motion.div
              key={event.id}
              className="bg-gray-800 p-4 rounded flex flex-col transform transition-all duration-300 hover:scale-105"
            >
              <h2 className="text-xl mb-2">{event.event_name}</h2>
              <p><strong>Venue:</strong> {event.venue_name}</p>
              <p><strong>Date:</strong> {event.date_local} {event.time_local}</p>
              <p><strong>City:</strong> {event.city}</p>
              <p><strong>Genre:</strong> {event.classification_name}</p>
              <p><strong>URL:</strong> {event.url}</p>
              <div className="flex space-x-2 mt-2">
                <button 
                  onClick={() => openModal(event)}
                  className="bg-blue-500 px-3 py-1 rounded hover:bg-blue-600"
                >
                  Edit
                </button>
                <button 
                  onClick={() => handleDeleteEvent(event.id)}
                  className="bg-red-500 px-3 py-1 rounded hover:bg-red-600"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal for Add/Edit Event */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 p-6 rounded w-11/12 max-w-md relative">
            <h2 className="text-2xl mb-4">{editingEvent ? 'Edit Event' : 'Add Event'}</h2>
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="mb-4">
                <label className="block mb-1">Event Name</label>
                <input type="text" {...register("event_name", { required: true })} className="w-full p-2 rounded bg-gray-800" />
              </div>
              <div className="mb-4">
                <label className="block mb-1">Classification (Genre)</label>
                <input type="text" {...register("classification_name")} className="w-full p-2 rounded bg-gray-800" />
              </div>
              <div className="mb-4">
                <label className="block mb-1">City</label>
                <input type="text" {...register("city")} className="w-full p-2 rounded bg-gray-800" />
              </div>
              <div className="mb-4">
                <label className="block mb-1">Date</label>
                <input type="date" {...register("date_local")} className="w-full p-2 rounded bg-gray-800" />
              </div>
              <div className="mb-4">
                <label className="block mb-1">Time</label>
                <input type="time" {...register("time_local")} className="w-full p-2 rounded bg-gray-800" />
              </div>
              <div className="mb-4">
                <label className="block mb-1">Venue Name</label>
                <input type="text" {...register("venue_name", { required: true })} className="w-full p-2 rounded bg-gray-800" />
              </div>
              <div className="mb-4">
                <label className="block mb-1">URL</label>
                <input type="text" {...register("url")} className="w-full p-2 rounded bg-gray-800" />
              </div>
              <div className="flex justify-end space-x-2">
                <button type="button" onClick={closeModal} className="bg-gray-500 px-4 py-2 rounded hover:bg-gray-600">Cancel</button>
                <button type="submit" className="bg-green-500 px-4 py-2 rounded hover:bg-green-600">{editingEvent ? 'Update' : 'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CombinedGigs;
