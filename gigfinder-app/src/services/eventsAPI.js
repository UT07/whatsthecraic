import { apiClient } from './apiClient';

const API_BASE = process.env.REACT_APP_API_BASE || 'https://api.whatsthecraic.run.place';

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
  getSavedEvents: async () => {
    const response = await apiClient.get('/v1/users/me/saved');
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
  hideEvent: async (eventId) => {
    const response = await apiClient.post(`/v1/events/${eventId}/hide`);
    return response.data;
  },
  unhideEvent: async (eventId) => {
    const response = await apiClient.delete(`/v1/events/${eventId}/hide`);
    return response.data;
  },
  getHiddenEvents: async () => {
    const response = await apiClient.get('/v1/users/me/hidden');
    return response.data;
  },
  getPerformers: async (filters) => {
    const response = await apiClient.get('/v1/performers', { params: filters });
    return response.data;
  },
  getAlerts: async () => {
    const response = await apiClient.get('/v1/alerts');
    return response.data;
  },
  createAlert: async (payload) => {
    const response = await apiClient.post('/v1/alerts', payload);
    return response.data;
  },
  deleteAlert: async (alertId) => {
    const response = await apiClient.delete(`/v1/alerts/${alertId}`);
    return response.data;
  },
  checkAlertNotifications: async () => {
    const response = await apiClient.get('/v1/alerts/notifications');
    return response.data;
  },
  getPlans: async () => {
    const response = await apiClient.get('/v1/organizer/plans');
    return response.data;
  },
  createPlan: async (payload) => {
    const response = await apiClient.post('/v1/organizer/plans', payload);
    return response.data;
  },
  getPlan: async (planId) => {
    const response = await apiClient.get(`/v1/organizer/plans/${planId}`);
    return response.data;
  },
  updatePlan: async (planId, payload) => {
    const response = await apiClient.put(`/v1/organizer/plans/${planId}`, payload);
    return response.data;
  },
  searchPlanDjs: async (planId, payload) => {
    const response = await apiClient.post(`/v1/organizer/plans/${planId}/search/djs`, payload);
    return response.data;
  },
  searchPlanVenues: async (planId, payload) => {
    const response = await apiClient.post(`/v1/organizer/plans/${planId}/search/venues`, payload);
    return response.data;
  },
  addShortlistItem: async (planId, payload) => {
    const response = await apiClient.post(`/v1/organizer/plans/${planId}/shortlist`, payload);
    return response.data;
  },
  getShortlist: async (planId) => {
    const response = await apiClient.get(`/v1/organizer/plans/${planId}/shortlist`);
    return response.data;
  },
  getContactTemplates: async () => {
    const response = await apiClient.get('/v1/organizer/contact-templates');
    return response.data;
  },
  createContactRequest: async (payload) => {
    const response = await apiClient.post('/v1/organizer/contact-requests', payload);
    return response.data;
  },
  getContactRequests: async () => {
    const response = await apiClient.get('/v1/organizer/contact-requests');
    return response.data;
  },
  getShortlistExportUrl: (planId, format = 'csv') =>
    `${API_BASE}/v1/organizer/plans/${planId}/shortlist/export?format=${format}`,
  getEventCalendarUrl: (eventId) => `${API_BASE}/v1/events/${eventId}/calendar`,
  getUserCalendarUrl: (token) => `${API_BASE}/v1/users/me/calendar${token ? `?token=${token}` : ''}`,
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
