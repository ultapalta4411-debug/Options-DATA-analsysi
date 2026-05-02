const BASE_URL = import.meta.env.VITE_API_URL || '';

const defaultHeaders = {
  'Content-Type': 'application/json',
};

async function fetchWithBase(url, options = {}) {
  const targetUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;
  const response = await fetch(targetUrl, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {}),
    },
    credentials: 'include',
  });

  return response;
}

export const baseUrl = BASE_URL;
export default {
  fetch: fetchWithBase,
};
