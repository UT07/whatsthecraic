import axios from "axios";

const API_BASE = process.env.REACT_APP_API_BASE;

export const fetchDJs = async () => {
  const response = await axios.get(`${API_BASE}/dj-service/djs`);
  return response.data;
};

export const addDJ = async (data) => {
  return axios.post(`${API_BASE}/dj-service/djs`, data);
};
export const updateDJ = async (data) => {
    return axios.put(`${API_BASE}/dj-service/djs/${id}`, data);
  };
export const deleteDJ = async (id) => {
  return axios.delete(`${API_BASE}/dj-service/djs/${id}`);
};
