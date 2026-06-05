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

export async function loginDev(_email: string, _password: string) {
  const res = await fetch(`${API_BASE}/api/v1/auth/dev-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: _email, password: _password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }
  const data = await res.json();
  localStorage.setItem('token', data.idToken);
  return data;
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

// ── Schedule ──
export function getScheduleActivities(projectId: string) {
  return fetchApi(`/api/v1/projects/${projectId}/schedule/activities`);
}

export function getScheduleBaselines(projectId: string) {
  return fetchApi(`/api/v1/projects/${projectId}/schedule/baselines`);
}

// ── Cost ──
export function getBudgetLines(projectId: string) {
  return fetchApi(`/api/v1/projects/${projectId}/cost/budget-lines`);
}

export function getEvm(projectId: string) {
  return fetchApi(`/api/v1/projects/${projectId}/cost/evm`);
}

// ── Procurement ──
export function getPurchaseOrders(projectId: string) {
  return fetchApi(`/api/v1/projects/${projectId}/procurement/purchase-orders`);
}

export function getInvoices(projectId: string) {
  return fetchApi(`/api/v1/projects/${projectId}/procurement/invoices`);
}

// ── Integration / Issues ──
export function getIssues(projectId: string) {
  return fetchApi(`/api/v1/projects/${projectId}/integration/issues`);
}

// ── Scope ──
export function getScopeStatements(projectId: string) {
  return fetchApi(`/api/v1/projects/${projectId}/scope/statements`);
}

export function getChangeOrders(projectId: string) {
  return fetchApi(`/api/v1/projects/${projectId}/scope/change-orders`);
}

// ── Communications ──
export function getRfis(projectId: string) {
  return fetchApi(`/api/v1/projects/${projectId}/communications/rfis`);
}

export function getSubmittals(projectId: string) {
  return fetchApi(`/api/v1/projects/${projectId}/communications/submittals`);
}

// ── Risk ──
export function getRisks(projectId: string) {
  return fetchApi(`/api/v1/projects/${projectId}/risk/items`);
}

// ── Resource ──
export function getEquipment(projectId: string) {
  return fetchApi(`/api/v1/projects/${projectId}/resource/equipment`);
}

export function getIdleEquipment(projectId: string) {
  return fetchApi(`/api/v1/projects/${projectId}/resource/idle-equipment`);
}
