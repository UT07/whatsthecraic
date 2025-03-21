// src/pages/CombinedGigs.jsx
import React, { useState, useEffect } from 'react';
import eventsAPI from '../services/eventsAPI';
import aggregatorAPI from '../services/aggregatorAPI';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';

const CombinedGigs = () => {
  const [defaultEvents, setDefaultEvents] = useState([]);
  const [searchResults, setSearchResults] = useState(null);
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
        console.log("Default events fetched:", data);
        setDefaultEvents(data);
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
          setSearchResults(null);
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
          setSearchResults(null);
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
          setSearchResults(null);
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
      .then((responseData) => {
        console.log("Search returned:", responseData);
        let results = [];

        // Convert responseData into a flat array if needed
        if (Array.isArray(responseData)) {
          results = responseData;
        } else if (responseData && Array.isArray(responseData.data)) {
          results = responseData.data;
        } else if (responseData && typeof responseData === 'object') {
          // Convert the object's values into a single flat array
          results = Object.values(responseData).flat();
        } else {
          console.error("Unexpected search response structure:", responseData);
        }

        console.log("Unwrapped search results:", results);
        setSearchResults(results);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error searching events:", error);
        setLoading(false);
      });
  };

  // Determine which events to display:
  const eventsToDisplay = searchResults !== null ? searchResults : defaultEvents;

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
        {searchResults !== null && (
          <p className="text-yellow-300 mb-2">
            Showing search results ({eventsToDisplay.length} found). Clear filters to see default events.
          </p>
        )}
      </div>

      {loading ? (
        <p className="text-green-400">Loading events...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {eventsToDisplay.length === 0 ? (
            <p className="text-red-400">No events found.</p>
          ) : (
            eventsToDisplay.map((event, index) => {
              console.log("Event item:", event); // Log each event to see the actual properties
              return (
                <motion.div
                  key={event.id || index}
                  className="bg-gray-800 p-4 rounded flex flex-col transform transition-all duration-300 hover:scale-105"
                >
                  {/* 
                    Update the JSX to match the actual property names from the console log:
                    eventName, date, time, venue, address, etc. 
                  */}
                  <h2 className="text-xl mb-2">{event.eventName}</h2>
                  <p><strong>Venue:</strong> {event.venue}</p>
                  <p><strong>Date:</strong> {event.date} {event.time}</p>
                  <p><strong>Address:</strong> {event.address}</p>
                  {/* If you have city or genre in the object, show them similarly:
                      <p><strong>City:</strong> {event.city}</p>
                      <p><strong>Genre:</strong> {event.genre}</p> 
                  */}
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
              );
            })
          )}
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
                <input type="text" {...register("eventName", { required: true })} className="w-full p-2 rounded bg-gray-800" />
              </div>
              <div className="mb-4">
                <label className="block mb-1">Date</label>
                <input type="date" {...register("date")} className="w-full p-2 rounded bg-gray-800" />
              </div>
              <div className="mb-4">
                <label className="block mb-1">Time</label>
                <input type="time" {...register("time")} className="w-full p-2 rounded bg-gray-800" />
              </div>
              <div className="mb-4">
                <label className="block mb-1">Venue</label>
                <input type="text" {...register("venue", { required: true })} className="w-full p-2 rounded bg-gray-800" />
              </div>
              <div className="mb-4">
                <label className="block mb-1">Address</label>
                <input type="text" {...register("address")} className="w-full p-2 rounded bg-gray-800" />
              </div>
              {/* 
                If you also want city, genre, or other fields, add them here to match your actual data. 
                For example:
                <div className="mb-4">
                  <label className="block mb-1">City</label>
                  <input type="text" {...register("city")} className="w-full p-2 rounded bg-gray-800" />
                </div>
              */}
              <div className="flex justify-end space-x-2">
                <button type="button" onClick={closeModal} className="bg-gray-500 px-4 py-2 rounded hover:bg-gray-600">
                  Cancel
                </button>
                <button type="submit" className="bg-green-500 px-4 py-2 rounded hover:bg-green-600">
                  {editingEvent ? 'Update' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CombinedGigs;
