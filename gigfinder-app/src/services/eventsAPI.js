import { apiClient } from './apiClient';

const eventsAPI = {
  // Canonical events search
  searchEvents: async (filters) => {
    const response = await apiClient.get('/v1/events/search', { params: filters });
    return response.data;
  },
  // Personalized feed
  getFeed: async (filters) => {
    const response = await apiClient.get('/v1/users/me/feed', { params: filters });
    return response.data;
  },
  getEvent: async (eventId) => {
    const response = await apiClient.get(`/v1/events/${eventId}`);
    return response.data;
  },
  saveEvent: async (eventId) => {
    const response = await apiClient.post(`/v1/events/${eventId}/save`);
    return response.data;
  },
  // Local/manual events (optional)
  getLocalEvents: async () => {
    const response = await apiClient.get('/events');
    return response.data;
  },
  addLocalEvent: async (eventData) => {
    const response = await apiClient.post('/events', eventData);
    return response.data;
  },
  updateLocalEvent: async (eventId, eventData) => {
    const response = await apiClient.put(`/events/${eventId}`, eventData);
    return response.data;
  },
  deleteLocalEvent: async (eventId) => {
    const response = await apiClient.delete(`/events/${eventId}`);
    return response.data;
  }
};

export default eventsAPI;
