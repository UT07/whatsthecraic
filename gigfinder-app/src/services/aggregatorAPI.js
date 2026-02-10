import { apiClient } from './apiClient';

const aggregatorAPI = {
  searchEvents: async (filters) => {
    const validFilters = Object.keys(filters)
      .filter(key => filters[key] && filters[key].trim() !== '')
      .reduce((acc, key) => {
        acc[key] = filters[key];
        return acc;
      }, {});

    const url = `/v1/events/search`;
    console.log("Search URL:", url, "with params:", validFilters);

    const response = await apiClient.get(url, { params: validFilters });
    return response.data.events || [];
  }
};

export default aggregatorAPI;
