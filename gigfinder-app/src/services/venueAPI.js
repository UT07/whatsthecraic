import { apiClient } from './apiClient';

const venueAPI = {
  // Get all venues
  getAllVenues: async () => {
    const response = await apiClient.get('/venues');
    return response.data;
  },
  searchVenues: async (filters) => {
    const response = await apiClient.get('/v1/venues/search', { params: filters });
    return response.data;
  },
  getAvailability: async (venueId) => {
    const response = await apiClient.get(`/v1/venues/${venueId}/availability`);
    return response.data;
  },
  addAvailability: async (venueId, payload) => {
    const response = await apiClient.post(`/v1/venues/${venueId}/availability`, payload);
    return response.data;
  },
  deleteAvailability: async (venueId, availabilityId) => {
    const response = await apiClient.delete(`/v1/venues/${venueId}/availability/${availabilityId}`);
    return response.data;
  },
  // Get one venue by id
  getVenue: async (venueId) => {
    const response = await apiClient.get(`/venues/${venueId}`);
    return response.data;
  },
  // Add a new venue (schema: name, address, capacity, genreFocus, latitude, longitude, notes)
  addVenue: async (venueData) => {
    const response = await apiClient.post('/venues', venueData);
    return response.data;
  },
  // Update an existing venue by id
  updateVenue: async (venueId, venueData) => {
    const response = await apiClient.put(`/venues/${venueId}`, venueData);
    return response.data;
  },
  // Delete a venue by id
  deleteVenue: async (venueId) => {
    const response = await apiClient.delete(`/venues/${venueId}`);
    return response.data;
  },
};

export default venueAPI;
