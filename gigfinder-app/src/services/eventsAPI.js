import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE || 'https://ec2-18-201-228-48.eu-west-1.compute.amazonaws.com';

const eventsAPI = {
  // Get all events (local_events table)
  getAllEvents: async () => {
    const response = await axios.get(`${API_BASE}/events`);
    return response.data;
  },
  // Get one event by id
  getEvent: async (eventId) => {
    const response = await axios.get(`${API_BASE}/events/${eventId}`);
    return response.data;
  },
  // Add a new event (fields: event_name, classification_name, city, date_local, time_local, venue_name, url)
  addEvent: async (eventData) => {
    const response = await axios.post(`${API_BASE}/events`, eventData);
    return response.data;
  },
  // Update an existing event by id
  updateEvent: async (eventId, eventData) => {
    const response = await axios.put(`${API_BASE}/events/${eventId}`, eventData);
    return response.data;
  },
  // Delete an event by id
  deleteEvent: async (eventId) => {
    const response = await axios.delete(`${API_BASE}/events/${eventId}`);
    return response.data;
  },
};

export default eventsAPI;
