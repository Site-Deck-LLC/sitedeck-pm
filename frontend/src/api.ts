const API_BASE = import.meta.env.VITE_API_URL || '';

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function fetchApi(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }

  return res.json();
}

export async function login(token: string) {
  localStorage.setItem('token', token);
  return fetchApi('/api/v1/health');
}

export function logout() {
  localStorage.removeItem('token');
}

export function getProjects() {
  return fetchApi('/api/v1/projects');
}

export function getProject(id: string) {
  return fetchApi(`/api/v1/projects/${id}`);
}

export function getDashboard(id: string) {
  return fetchApi(`/api/v1/projects/${id}/dashboard/morning`);
}

export function getBillingStatus(orgId: string) {
  return fetchApi(`/api/v1/billing/status?orgId=${encodeURIComponent(orgId)}`);
}
