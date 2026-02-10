import axios from "axios";

const API_BASE = process.env.REACT_APP_API_BASE;

export const fetchEvents = async () => {
  const response = await axios.get(`${API_BASE}/aggregator-service/events`);
  return response.data;
};
