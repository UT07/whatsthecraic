import axios from 'axios';

const API_BASE = 'https://ec2-18-201-228-48.eu-west-1.compute.amazonaws.com';

const aggregatorAPI = {
  searchEvents: async (filters) => {
    const validFilters = Object.keys(filters)
      .filter(key => filters[key] && filters[key].trim() !== '')
      .reduce((acc, key) => {
        acc[key] = filters[key];
        return acc;
      }, {});

    const url = `${API_BASE}/api/gigs`;
    console.log("Search URL:", url, "with params:", validFilters);

    const response = await axios.get(url, { params: validFilters });
    return response.data.gigs;
  }
};

export default aggregatorAPI;
