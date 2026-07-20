import axios from 'axios';
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './storage';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
});

// Attach the access token to every request.
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On a 401, try to refresh once, then replay the original request.
let refreshing = null;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const isAuthCall = original?.url?.includes('/auth/');

    if (status === 401 && !original._retry && !isAuthCall && getRefreshToken()) {
      original._retry = true;
      try {
        refreshing =
          refreshing ||
          axios
            .post(`${api.defaults.baseURL}/auth/refresh`, { refreshToken: getRefreshToken() })
            .then((r) => r.data.data);
        const tokens = await refreshing;
        refreshing = null;
        setTokens(tokens);
        original.headers.Authorization = `Bearer ${tokens.accessToken}`;
        return api(original);
      } catch (e) {
        refreshing = null;
        clearTokens();
        if (window.location.pathname !== '/login') window.location.assign('/login');
        return Promise.reject(e);
      }
    }
    return Promise.reject(error);
  },
);

// Unwraps the API's { success, data } envelope for convenience.
export const unwrap = (promise) => promise.then((r) => r.data.data);

// Extracts a human-readable message from an error response.
export const errorMessage = (err, fallback = 'Something went wrong') =>
  err?.response?.data?.error?.message || err?.message || fallback;

export default api;
