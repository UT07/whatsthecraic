import { apiClient } from './apiClient';

const venueAPI = {
  // Get all venues
  getAllVenues: async () => {
    const response = await apiClient.get('/venues');
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
