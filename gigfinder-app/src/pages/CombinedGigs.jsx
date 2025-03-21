// src/pages/CombinedGigs.jsx
import React, { useState, useEffect } from 'react';
import eventsAPI from '../services/eventsAPI';
import aggregatorAPI from '../services/aggregatorAPI';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';

// Helper: Convert local event fields to a unified structure
function unifyLocalEvents(localData = []) {
  return localData.map(evt => ({
    // Transform local properties to aggregator-like fields
    eventName: evt.event_name || evt.eventName,
    venue: evt.venue_name || evt.venue,
    date: evt.date_local || evt.date,
    time: evt.time_local || evt.time,
    address: evt.address || 'N/A',
    // For local events, ticketLink might be missing.
    // If missing, ticketLink will be null.
    ticketLink: evt.ticket_link || evt.ticketLink || null,
    source: evt.source || 'Local',
    id: evt.id,
  }));
}

const CombinedGigs = () => {
  const [events, setEvents] = useState([]);
  const [searchResults, setSearchResults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  // Filters are used only for aggregator searches
  const [filters, setFilters] = useState({
    city: '',
    genre: '',
    djName: '',
    venue: ''
  });

  const { register, handleSubmit, reset } = useForm();

  const fetchEvents = () => {
    eventsAPI.getAllEvents()
      .then((data) => {
        console.log("Fetched events (raw):", data);
        const unifiedLocal = unifyLocalEvents(data);
        console.log("Unified local events:", unifiedLocal);
        setEvents(unifiedLocal);
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
    reset(event || {});
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
        console.log("Search results (raw):", responseData);
        let results = [];
        if (Array.isArray(responseData)) {
          results = responseData;
        } else if (responseData && Array.isArray(responseData.data)) {
          results = responseData.data;
        } else if (responseData && typeof responseData === 'object') {
          results = Object.values(responseData).flat();
        } else {
          console.error("Unexpected search response structure:", responseData);
        }
        console.log("Aggregator results:", results);
        setSearchResults(results);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error searching events:", error);
        setLoading(false);
      });
  };

  // Display aggregator results if available; otherwise show local events
  const eventsToDisplay = searchResults !== null ? searchResults : events;

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl mb-4">Events</h1>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <input
            type="text"
            placeholder="City"
            className="p-2 rounded bg-gray-800"
            value={filters.city}
            onChange={(e) => setFilters({ ...filters, city: e.target.value })}
          />
          <input
            type="text"
            placeholder="Genre"
            className="p-2 rounded bg-gray-800"
            value={filters.genre}
            onChange={(e) => setFilters({ ...filters, genre: e.target.value })}
          />
          <input
            type="text"
            placeholder="DJ Name"
            className="p-2 rounded bg-gray-800"
            value={filters.djName}
            onChange={(e) => setFilters({ ...filters, djName: e.target.value })}
          />
          <input
            type="text"
            placeholder="Venue Name"
            className="p-2 rounded bg-gray-800"
            value={filters.venue}
            onChange={(e) => setFilters({ ...filters, venue: e.target.value })}
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
            Showing search results ({eventsToDisplay.length} found).
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
              // For local events (source "Local"), we show the button always;
              // For others, we show it only if event.ticketLink exists.
              const showTicketButton = event.source === "Local" || event.ticketLink;
              // Set card background: Local events get gray, others neon green.
              const cardClasses = `p-4 rounded flex flex-col transform transition-all duration-300 hover:scale-105 ${
                event.source === "Local" ? "bg-gray-800" : "bg-[#39FF14]"
              }`;
              return (
                <motion.div key={event.id || index} className={cardClasses}>
                  <h2 className="text-xl mb-2">{event.eventName}</h2>
                  <p><strong>Venue:</strong> {event.venue}</p>
                  <p><strong>Date:</strong> {event.date} {event.time}</p>
                  <p><strong>Address:</strong> {event.address}</p>
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
                    {showTicketButton && (
                      <a
                        href={event.ticketLink ? event.ticketLink : "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`bg-purple-500 px-3 py-1 rounded ${
                          event.ticketLink ? "hover:bg-purple-600" : "opacity-50 cursor-not-allowed"
                        }`}
                      >
                        Buy Tickets
                      </a>
                    )}
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
              <input 
                type="text" 
                {...register("eventName", { required: true })} 
                placeholder="Event Name" 
                className="w-full p-2 mb-2 rounded bg-gray-800" 
              />
              <input 
                type="date" 
                {...register("date")} 
                className="w-full p-2 mb-2 rounded bg-gray-800" 
              />
              <input 
                type="time" 
                {...register("time")} 
                className="w-full p-2 mb-2 rounded bg-gray-800" 
              />
              <input 
                type="text" 
                {...register("venue")} 
                placeholder="Venue Name" 
                className="w-full p-2 mb-2 rounded bg-gray-800" 
              />
              <input 
                type="text" 
                {...register("address")} 
                placeholder="Address" 
                className="w-full p-2 mb-2 rounded bg-gray-800" 
              />
              {/* Field for ticket link */}
              <input 
                type="text" 
                {...register("ticketLink")} 
                placeholder="Ticket Link (optional)" 
                className="w-full p-2 mb-2 rounded bg-gray-800" 
              />
              <button type="submit" className="bg-green-500 px-4 py-2 rounded hover:bg-green-600">
                {editingEvent ? 'Update' : 'Add'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default CombinedGigs;
