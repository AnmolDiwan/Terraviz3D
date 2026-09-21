import { apiFetch } from './api.js';

const API_BASE = import.meta.env.VITE_API_URL || '';

export const authService = {
  login: (username, password) => 
    apiFetch(`${API_BASE}/api/auth/login`, { method: 'POST', body: JSON.stringify({ username, password }) }),
    
  register: (username, email, password) => 
    apiFetch(`${API_BASE}/api/auth/register`, { method: 'POST', body: JSON.stringify({ username, email, password }) }),
    
  logout: (sessionId) => 
    apiFetch(`${API_BASE}/api/auth/logout`, { method: 'POST', body: JSON.stringify({ sessionId }) }),
    
  getMe: () => 
    apiFetch(`${API_BASE}/api/auth/me`)
};
