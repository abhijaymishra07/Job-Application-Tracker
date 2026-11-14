import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('jobtrack_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('jobtrack_token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

function saveBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

export async function downloadApplicationFile(id, kind, filename) {
  const res = await api.get(`/applications/${id}/files/${kind}`, { responseType: 'blob' });
  saveBlob(res.data, filename || `${kind}.pdf`);
}

export async function downloadApplicationsCsv(params) {
  const res = await api.get('/applications/export', { params, responseType: 'blob' });
  saveBlob(res.data, `applications-${new Date().toISOString().slice(0, 10)}.csv`);
}

export function liveStreamUrl() {
  const token = localStorage.getItem('jobtrack_token');
  return `/api/notifications/stream?token=${encodeURIComponent(token || '')}`;
}

export default api;
