import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE;

const aggregatorAPI = {
  searchEvents: async (filters) => {
    const response = await axios.get(`${API_BASE}/events`, { params: filters });
    return response.data;
  }
};

export default aggregatorAPI;
