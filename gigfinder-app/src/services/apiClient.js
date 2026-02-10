import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE || 'https://api.whatsthecraic.run.place';
const AUTH_BASE = process.env.REACT_APP_AUTH_BASE || 'https://auth.whatsthecraic.run.place';

export const getToken = () => localStorage.getItem('wtcToken');
export const setToken = (token) => {
  if (token) {
    localStorage.setItem('wtcToken', token);
  } else {
    localStorage.removeItem('wtcToken');
  }
};

export const getUser = () => {
  const raw = localStorage.getItem('wtcUser');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const setUser = (user) => {
  if (user) {
    localStorage.setItem('wtcUser', JSON.stringify(user));
  } else {
    localStorage.removeItem('wtcUser');
  }
};

const attachAuth = (config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};

export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 12000
});

export const authClient = axios.create({
  baseURL: AUTH_BASE,
  timeout: 12000
});

apiClient.interceptors.request.use(attachAuth);
authClient.interceptors.request.use(attachAuth);
