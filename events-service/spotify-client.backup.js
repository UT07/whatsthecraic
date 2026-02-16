const axios = require('axios');

const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';

let cachedToken = null;
let tokenExpiresAt = 0;

const getAccessToken = async (clientId, clientSecret) => {
  if (cachedToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  const response = await axios.post(SPOTIFY_TOKEN_URL,
    new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      auth: { username: clientId, password: clientSecret },
      timeout: 10000
    }
  );

  cachedToken = response.data.access_token;
  tokenExpiresAt = Date.now() + (response.data.expires_in * 1000);
  return cachedToken;
};

const makeRequest = async (clientId, clientSecret, path, params = {}) => {
  const token = await getAccessToken(clientId, clientSecret);
  const response = await axios.get(`${SPOTIFY_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
    timeout: 10000
  });
  return response.data;
};

/**
 * Search for artists on Spotify
 * @returns {Array} [{name, id, genres, popularity, followers, image, spotifyUrl}]
 */
const searchArtists = async (clientId, clientSecret, query, limit = 20) => {
  const data = await makeRequest(clientId, clientSecret, '/search', {
    q: query,
    type: 'artist',
    limit: Math.min(limit, 50)
  });

  return (data.artists?.items || []).map(a => ({
    name: a.name,
    spotifyId: a.id,
    genres: a.genres || [],
    popularity: a.popularity || 0,
    followers: a.followers?.total || 0,
    image: a.images?.[0]?.url || null,
    images: (a.images || []).map(img => ({ url: img.url, width: img.width, height: img.height })),
    spotifyUrl: a.external_urls?.spotify || null
  }));
};

/**
 * Get a single artist by Spotify ID
 */
const getArtist = async (clientId, clientSecret, artistId) => {
  const a = await makeRequest(clientId, clientSecret, `/artists/${artistId}`);
  return {
    name: a.name,
    spotifyId: a.id,
    genres: a.genres || [],
    popularity: a.popularity || 0,
    followers: a.followers?.total || 0,
    image: a.images?.[0]?.url || null,
    images: (a.images || []).map(img => ({ url: img.url, width: img.width, height: img.height })),
    spotifyUrl: a.external_urls?.spotify || null
  };
};

/**
 * Get related artists for discovery
 */
const getRelatedArtists = async (clientId, clientSecret, artistId, limit = 10) => {
  const data = await makeRequest(clientId, clientSecret, `/artists/${artistId}/related-artists`);
  return (data.artists || []).slice(0, limit).map(a => ({
    name: a.name,
    spotifyId: a.id,
    genres: a.genres || [],
    popularity: a.popularity || 0,
    followers: a.followers?.total || 0,
    image: a.images?.[0]?.url || null,
    spotifyUrl: a.external_urls?.spotify || null
  }));
};

/**
 * Get artist top tracks
 */
const getTopTracks = async (clientId, clientSecret, artistId, market = 'IE') => {
  const data = await makeRequest(clientId, clientSecret, `/artists/${artistId}/top-tracks`, { market });
  return (data.tracks || []).map(t => ({
    name: t.name,
    previewUrl: t.preview_url,
    album: t.album?.name,
    albumImage: t.album?.images?.[0]?.url || null,
    durationMs: t.duration_ms,
    popularity: t.popularity
  }));
};

module.exports = {
  getAccessToken,
  searchArtists,
  getArtist,
  getRelatedArtists,
  getTopTracks
};
