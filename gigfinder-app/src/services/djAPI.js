import { apiClient } from './apiClient';

const djAPI = {
  // Get all DJs
  getAllDJs: async () => {
    const response = await apiClient.get('/djs');
    return response.data;
  },
  searchDJs: async (filters) => {
    const response = await apiClient.get('/v1/djs/search', { params: filters });
    return response.data;
  },
  // Get one DJ by id
  getDJ: async (djId) => {
    const response = await apiClient.get(`/djs/${djId}`);
    return response.data;
  },
  // Add a new DJ (based on your schema)
  addDJ: async (djData) => {
    const response = await apiClient.post('/djs', djData);
    return response.data;
  },
  // Update an existing DJ by id
  updateDJ: async (djId, djData) => {
    const response = await apiClient.put(`/djs/${djId}`, djData);
    return response.data;
  },
  // Delete a DJ by id
  deleteDJ: async (djId) => {
    const response = await apiClient.delete(`/djs/${djId}`);
    return response.data;
  },
};

export default djAPI;
