import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://whatsthecraic-alb-1707904777.eu-west-1.elb.amazonaws.com';

const djAPI = {
  // Get all DJs
  getAllDJs: async () => {
    const response = await axios.get(`${API_BASE}/djs`);
    return response.data;
  },
  // Get one DJ by id
  getDJ: async (djId) => {
    const response = await axios.get(`${API_BASE}/djs/${djId}`);
    return response.data;
  },
  // Add a new DJ (based on your schema)
  addDJ: async (djData) => {
    const response = await axios.post(`${API_BASE}/djs`, djData);
    return response.data;
  },
  // Update an existing DJ by id
  updateDJ: async (djId, djData) => {
    const response = await axios.put(`${API_BASE}/djs/${djId}`, djData);
    return response.data;
  },
  // Delete a DJ by id
  deleteDJ: async (djId) => {
    const response = await axios.delete(`${API_BASE}/djs/${djId}`);
    return response.data;
  },
};

export default djAPI;
