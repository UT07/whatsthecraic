import axios from 'axios';

const normalizeBase = (value) => (value || '').toString().replace(/\/+$/, '');

export const API_BASE = normalizeBase(process.env.REACT_APP_API_BASE || 'https://api.whatsthecraic.run.place');
// If auth base is not provided (local/dev), route auth calls through aggregator /v1 proxy.
export const AUTH_BASE = normalizeBase(process.env.REACT_APP_AUTH_BASE || `${API_BASE}/v1`);

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
