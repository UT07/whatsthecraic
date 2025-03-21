import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE;

const aggregatorAPI = {
  searchEvents: async (filters) => {
    // Remove keys with empty or whitespace-only values
    const validFilters = Object.keys(filters)
      .filter(key => filters[key] && filters[key].trim() !== '')
      .reduce((acc, key) => {
        acc[key] = filters[key];
        return acc;
      }, {});
      
    // Use the correct endpoint for aggregator searches
    const url = `/api/gigs`;
    console.log("Search URL:", url, "with params:", validFilters);

    const response = await axios.get(url, { params: validFilters });
    return response.data;
  }
};

export default aggregatorAPI;
