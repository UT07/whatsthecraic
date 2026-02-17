import { authClient } from './apiClient';

const authAPI = {
  signup: async (payload) => {
    const response = await authClient.post('/auth/signup', payload);
    return response.data;
  },
  login: async (payload) => {
    const response = await authClient.post('/auth/login', payload);
    return response.data;
  },
  getSpotifyStatus: async () => {
    const response = await authClient.get('/auth/spotify/status');
    return response.data;
  },
  syncSpotify: async () => {
    const response = await authClient.post('/auth/spotify/sync');
    return response.data;
  },
  getSpotifyProfile: async () => {
    const response = await authClient.get('/auth/spotify/profile');
    return response.data;
  },
  getSoundCloudStatus: async () => {
    const response = await authClient.get('/auth/soundcloud/status');
    return response.data;
  },
  connectSoundCloud: async (payload) => {
    const response = await authClient.post('/auth/soundcloud/connect', payload);
    return response.data;
  },
  syncSoundCloud: async () => {
    const response = await authClient.post('/auth/soundcloud/sync');
    return response.data;
  },
  getSoundCloudProfile: async () => {
    const response = await authClient.get('/auth/soundcloud/profile');
    return response.data;
  },
  disconnectSoundCloud: async () => {
    const response = await authClient.delete('/auth/soundcloud/disconnect');
    return response.data;
  },
  getPreferences: async () => {
    const response = await authClient.get('/auth/preferences');
    return response.data;
  },
  savePreferences: async (payload) => {
    const response = await authClient.post('/auth/preferences', payload);
    return response.data;
  },
  resetPassword: async (payload) => {
    const response = await authClient.post('/auth/reset-password', payload);
    return response.data;
  }
};

export default authAPI;
