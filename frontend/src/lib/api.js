import axios from 'axios';

// HTTP client for the MedStock FastAPI backend.
//
// Login gives a short-lived access token (kept only in memory, never in localStorage) and sets two
// cookies: an HttpOnly refresh cookie the page can't read, and a readable CSRF cookie. When the access
// token expires (or after a page reload) the client calls /auth/refresh once, sending the CSRF value
// back in the X-CSRF-Token header, and retries the request.

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';
const CSRF_COOKIE = 'msm_csrf_token';

let accessToken = null;

export const tokenStore = {
  get: () => accessToken,
  set: (t) => {
    accessToken = t;
  },
  clear: () => {
    accessToken = null;
  },
};

/** The CSRF cookie set at login; also tells us a refresh session probably exists. */
export const csrfToken = () => {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${CSRF_COOKIE}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
};

const api = axios.create({ baseURL: BASE_URL, withCredentials: true });

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  const csrf = csrfToken();
  if (csrf && config.method && config.method !== 'get') config.headers['X-CSRF-Token'] = csrf;
  return config;
});

let refreshing = null;

/** Gets a new access token from the refresh cookie. One request at a time, shared by all callers. */
export function refreshSession() {
  if (!refreshing) {
    refreshing = axios
      .post(`${BASE_URL}/auth/refresh`, null, { withCredentials: true, headers: { 'X-CSRF-Token': csrfToken() || '' } })
      .then((r) => {
        accessToken = r.data.data.access_token;
        return accessToken;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

const isAuthCall = (url = '') => /\/auth\/(login|refresh|logout)$/.test(url);

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const { config, response } = err;
    if (response?.status === 401 && config && !isAuthCall(config.url) && !config._retried) {
      try {
        await refreshSession();
        return api({ ...config, _retried: true });
      } catch {
        accessToken = null;
        window.dispatchEvent(new Event('auth:expired'));
      }
    }
    return Promise.reject(err);
  },
);

// FastAPI validation errors: data = [{ loc: ['body', 'items', 0, 'quantity'], msg }]
const validationList = (err) => (err?.response?.status === 422 && Array.isArray(err.response.data?.data) ? err.response.data.data : null);

/** A message to show the user for a failed request. */
export const errMsg = (e) => {
  const list = validationList(e);
  if (list?.length) return list[0].msg?.replace(/^Value error, /, '') || 'Invalid input';
  if (!e?.response) return e?.message === 'Network Error' ? 'Cannot reach the server. Check the connection and try again.' : e?.message || 'Something went wrong';
  return e.response.data?.message || e.message || 'Something went wrong';
};

/** Field errors from a 422 response, keyed by backend field path ("items.0.quantity"). */
export const apiFieldErrors = (e) => {
  const out = {};
  for (const item of validationList(e) || []) {
    const key = (item.loc || []).filter((p) => p !== 'body' && p !== 'query').join('.');
    if (key && !out[key]) out[key] = item.msg?.replace(/^Value error, /, '');
  }
  return out;
};

export default api;
