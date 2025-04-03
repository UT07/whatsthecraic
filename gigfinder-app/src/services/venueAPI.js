import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE || 'https://ec2-18-201-228-48.eu-west-1.compute.amazonaws.com';

const venueAPI = {
  // Get all venues
  getAllVenues: async () => {
    const response = await axios.get(`${API_BASE}/venues`);
    return response.data;
  },
  // Get one venue by id
  getVenue: async (venueId) => {
    const response = await axios.get(`${API_BASE}/venues/${venueId}`);
    return response.data;
  },
  // Add a new venue (schema: name, address, capacity, genreFocus, latitude, longitude, notes)
  addVenue: async (venueData) => {
    const response = await axios.post(`${API_BASE}/venues`, venueData);
    return response.data;
  },
  // Update an existing venue by id
  updateVenue: async (venueId, venueData) => {
    const response = await axios.put(`${API_BASE}/venues/${venueId}`, venueData);
    return response.data;
  },
  // Delete a venue by id
  deleteVenue: async (venueId) => {
    const response = await axios.delete(`${API_BASE}/venues/${venueId}`);
    return response.data;
  },
};

export default venueAPI;
