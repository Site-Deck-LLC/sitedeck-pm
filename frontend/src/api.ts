const API_BASE = import.meta.env.VITE_API_URL || '';

function getToken(): string | null {
  return localStorage.getItem('token');
}

/**
 * In-memory cache of the most recent Firebase ID token. We keep this
 * in memory (not localStorage) per Firebase's security guidance — a
 * long-lived token in localStorage is reachable by any XSS payload
 * and is replayable until expiry. The onAuthStateChanged listener
 * refreshes this on every Firebase state change.
 */
let firebaseToken: string | null = null;
let firebaseTokenSetAt: number = 0;
const FIREBASE_TOKEN_TTL_MS = 50 * 60 * 1000; // 50 min — refresh before 60 min expiry

export function setFirebaseToken(token: string | null) {
  firebaseToken = token;
  firebaseTokenSetAt = token ? Date.now() : 0;
  if (token) {
    // Cache for the Authorization header on every fetchApi call.
    // Persisted copy in localStorage is the dev-token fallback only.
    localStorage.setItem('token', token);
  }
}

export function getFirebaseToken(): string | null {
  if (!firebaseToken) return null;
  // Auto-clear if the cached token is past the soft TTL — the next
  // call will trigger Firebase to mint a fresh one.
  if (Date.now() - firebaseTokenSetAt > FIREBASE_TOKEN_TTL_MS) return null;
  return firebaseToken;
}

/**
 * Force-refresh the Firebase ID token. Returns the new token, or
 * null if the user is signed out / Firebase is not configured.
 * Caller is expected to call setFirebaseToken() with the result.
 */
export async function refreshFirebaseToken(): Promise<string | null> {
  try {
    const { getFirebaseAuth } = await import('./firebase');
    const auth = getFirebaseAuth();
    if (!auth?.currentUser) return null;
    const fresh = await auth.currentUser.getIdToken(true);
    setFirebaseToken(fresh);
    return fresh;
  } catch {
    return null;
  }
}

async function fetchApi<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getFirebaseToken() || getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  const method = String(options.method || 'GET').toUpperCase();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  // Sprint 10: capture the most recent API call for the Get Help button.
  // We do this AFTER the response so we can include status + parsed body.
  // The buffer is in the GetHelpButton module — we import lazily to keep
  // the API file free of UI coupling.
  try {
    const { getHelpBuffer } = await import('./components/GetHelpButton');
    let responseSummary: unknown = null;
    try {
      const cloned = res.clone();
      const text = await cloned.text();
      // Bound the captured response to 1KB so a huge payload doesn't
      // blow out the BugReport.consoleErrors Json.
      responseSummary = text.length > 1024 ? text.slice(0, 1024) + '…' : text;
    } catch {
      // ignore body capture failure
    }
    getHelpBuffer.setLastApiCall({
      endpoint: path,
      method,
      status: res.status,
      response: responseSummary,
      ts: Date.now(),
    });
  } catch {
    // ignore — buffer module may not be loaded yet
  }

  // 401 with token_expired: try one forced refresh + retry. If the
  // refresh also yields 401, the second error propagates and the
  // caller (App.tsx, error boundary) can force a logout.
  if (res.status === 401 && !(options as any).__retried) {
    const err = await res.json().catch(() => null);
    if (err?.error?.code === 'token_expired') {
      const fresh = await refreshFirebaseToken();
      if (fresh) {
        return fetchApi<T>(path, { ...options, __retried: true } as any);
      }
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export { fetchApi };

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

/**
 * Sign out: revoke the Firebase session (best-effort), clear the
 * in-memory + localStorage tokens, and redirect to /login.
 */
export async function logout() {
  try {
    const { getFirebaseAuth } = await import('./firebase');
    const auth = getFirebaseAuth();
    if (auth?.currentUser) await auth.signOut();
  } catch {
    // Best-effort. Local clear still happens below.
  }
  firebaseToken = null;
  firebaseTokenSetAt = 0;
  localStorage.removeItem('token');
  if (typeof window !== 'undefined') {
    window.location.href = '/login';
  }
}

export function getProjects() {
  return fetchApi('/api/v1/projects');
}

export function getProjectMapData() {
  return fetchApi('/api/v1/projects/map');
}

export function getPortfolioSummary() {
  return fetchApi('/api/v1/portfolio/summary');
}

export function getNotifications(opts: { unreadOnly?: boolean; limit?: number; cursor?: string } = {}) {
  const params = new URLSearchParams();
  if (opts.unreadOnly) params.set('unread', 'true');
  if (opts.limit) params.set('limit', String(opts.limit));
  if (opts.cursor) params.set('cursor', opts.cursor);
  const qs = params.toString();
  return fetchApi<{ notifications: Notification[]; nextCursor: string | null }>(
    `/api/v1/notifications${qs ? `?${qs}` : ''}`
  );
}

export function getUnreadNotificationCount() {
  return fetchApi<{ count: number }>('/api/v1/notifications/unread-count');
}

export function markNotificationRead(id: string) {
  return fetchApi(`/api/v1/notifications/${id}/read`, { method: 'PATCH' });
}

export function markAllNotificationsRead() {
  return fetchApi<{ updated: number }>('/api/v1/notifications/mark-all-read', { method: 'POST' });
}

// ── Notification preferences (Sprint 12 Task 8) ──
export interface NotificationPreferences {
  userId: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  digestEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  kindOverrides: Record<string, { email?: boolean | null; push?: boolean | null }>;
  updatedAt: string;
  createdAt: string;
}

export function getNotificationPreferences() {
  return fetchApi<NotificationPreferences>('/api/v1/notifications/preferences/me');
}

export function updateNotificationPreferences(body: Partial<NotificationPreferences>) {
  return fetchApi<NotificationPreferences>('/api/v1/notifications/preferences/me', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export interface Notification {
  id: string;
  userId: string;
  kind: string;
  title: string;
  body: string | null;
  payload: Record<string, unknown> | null;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

export function getProject(id: string) {
  return fetchApi(`/api/v1/projects/${id}`);
}

export function getDashboard(id: string) {
  return fetchApi(`/api/v1/projects/${id}/dashboard/morning`);
}

export function getProjectValue(id: string) {
  return fetchApi(`/api/v1/projects/${id}`);
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

export function getSchedulePerformance(projectId: string) {
  return fetchApi(`/api/v1/projects/${projectId}/schedule/performance`);
}

export function getScheduleRelationships(projectId: string) {
  return fetchApi(`/api/v1/projects/${projectId}/schedule/relationships`);
}

export function getActivity(projectId: string, activityId: string) {
  return fetchApi(`/api/v1/projects/${projectId}/schedule/activities/${activityId}`);
}

export function getActivityRelationships(projectId: string, activityId: string) {
  return fetchApi(`/api/v1/projects/${projectId}/schedule/activities/${activityId}/relationships`);
}

export function patchActivity(projectId: string, activityId: string, data: any) {
  return fetchApi(`/api/v1/projects/${projectId}/schedule/activities/${activityId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function getWhatIf(projectId: string, activityId: string, delayDays: number, delayType: 'start_delay' | 'duration_extension') {
  const params = new URLSearchParams({ activityId, delayDays: String(delayDays), delayType });
  return fetchApi(`/api/v1/projects/${projectId}/schedule/whatif?${params.toString()}`);
}

export function getEquipmentRegistry(projectId: string) {
  return fetchApi(`/api/v1/projects/${projectId}/resource/equipment-registry`);
}

export function getEquipmentDetail(projectId: string, equipId: string) {
  return fetchApi(`/api/v1/projects/${projectId}/resource/equipment-registry/${equipId}`);
}

export function createEquipment(projectId: string, data: any) {
  return fetchApi(`/api/v1/projects/${projectId}/resource/equipment-registry`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateEquipment(projectId: string, equipId: string, data: any) {
  return fetchApi(`/api/v1/projects/${projectId}/resource/equipment-registry/${equipId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function getEquipmentHistory(projectId: string, equipId: string) {
  return fetchApi(`/api/v1/projects/${projectId}/resource/equipment-registry/${equipId}/history`);
}

export async function importXer(projectId: string, file: File) {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}/schedule/import/xer`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function importMsProject(projectId: string, file: File) {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}/schedule/import/msproject`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function importExcelSchedule(projectId: string, file: File) {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/api/v1/projects/${projectId}/schedule/import/excel`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Cost ──
export function getBudgetLines(projectId: string) {
  return fetchApi(`/api/v1/projects/${projectId}/cost/budget-lines`);
}

export function getEvm(projectId: string) {
  return fetchApi(`/api/v1/projects/${projectId}/cost/evm`);
}

export interface EvmForecasts {
  projectId: string;
  bac: number;
  ev: number;
  ac: number;
  pv: number;
  cpi: number;
  spi: number;
  tcpi: number;
  tcpiFlag: 'tight' | 'on_pace' | 'cushion' | 'unknown';
  eac_cpi: number;
  eac_spi: number;
  eac_replan: number;
  vac: number;
  daysElapsed: number;
  daysRemaining: number;
  forecastCompleteDate: string | null;
  baselineCompleteDate: string | null;
  completeDateDeltaDays: number | null;
  confidenceRange: { optimistic: number; mostLikely: number; pessimistic: number };
}

export function getEvmForecasts(projectId: string) {
  return fetchApi<EvmForecasts>(`/api/v1/projects/${projectId}/cost/forecasts`);
}

export function getCashFlow(projectId: string) {
  return fetchApi(`/api/v1/projects/${projectId}/cost/cashflow`);
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

export function getChangeOrder(projectId: string, coId: string) {
  return fetchApi(`/api/v1/projects/${projectId}/scope/change-orders/${coId}`);
}

export function patchChangeOrder(projectId: string, coId: string, body: {
  action: 'submit' | 'approve' | 'reject' | 'update';
  approver?: string;
  description?: string;
  dollarValue?: number;
  scheduleImpact?: number;
  affectedActivityIds?: string[];
}) {
  return fetchApi(`/api/v1/projects/${projectId}/scope/change-orders/${coId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
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

// ── Safety ──
export function getSafetyPerformance(projectId: string) {
  return fetchApi(`/api/v1/projects/${projectId}/safety/performance`);
}

// ── Resource ──
export function getEquipment(projectId: string) {
  return fetchApi(`/api/v1/projects/${projectId}/resource/equipment`);
}

export function getIdleEquipment(projectId: string) {
  return fetchApi(`/api/v1/projects/${projectId}/resource/idle-equipment`);
}

export function getAttendanceToday(projectId: string, dateIso?: string) {
  const q = dateIso ? `?date=${encodeURIComponent(dateIso)}` : '';
  return fetchApi(`/api/v1/projects/${projectId}/resource/attendance/today${q}`);
}

export function postAttendance(projectId: string, body: {
  date?: string;
  workerCount: number;
  hours: number;
  presentCount?: number;
  absentCount?: number;
  lateCount?: number;
  notes?: string;
  affectedActivities?: string[];
}) {
  return fetchApi(`/api/v1/projects/${projectId}/resource/attendance`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function postEquipment(projectId: string, body: {
  externalId: string;
  name: string;
  type?: string;
  currentActivityId?: string;
}) {
  return fetchApi(`/api/v1/projects/${projectId}/resource/equipment`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function postEquipmentStatusLog(projectId: string, body: {
  equipmentId: string;
  date?: string;
  status: string;
  hours?: number;
  notes?: string;
  loggedBy?: string;
}) {
  return fetchApi(`/api/v1/projects/${projectId}/resource/equipment/status-log`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function getEquipmentStatusLog(projectId: string, startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  const q = params.toString();
  return fetchApi(`/api/v1/projects/${projectId}/resource/equipment/status-log${q ? `?${q}` : ''}`);
}

// ── Crew ──
export function getCrewStatus(projectId: string) {
  return fetchApi(`/api/v1/projects/${projectId}/crew/status`);
}

// ── Communications / Meetings ──
export function getMeetings(projectId: string, startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  if (startDate) params.set('startDate', startDate);
  if (endDate) params.set('endDate', endDate);
  const qs = params.toString();
  return fetchApi(`/api/v1/projects/${projectId}/communications/meetings${qs ? `?${qs}` : ''}`);
}

export function getMeeting(projectId: string, meetingId: string) {
  return fetchApi(`/api/v1/projects/${projectId}/communications/meetings/${meetingId}`);
}

export function createMeeting(projectId: string, data: any) {
  return fetchApi(`/api/v1/projects/${projectId}/communications/meetings`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateMeeting(projectId: string, meetingId: string, data: any) {
  return fetchApi(`/api/v1/projects/${projectId}/communications/meetings/${meetingId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteMeeting(projectId: string, meetingId: string) {
  return fetchApi(`/api/v1/projects/${projectId}/communications/meetings/${meetingId}`, {
    method: 'DELETE',
  });
}

export function updateMeetingActionItemStatus(
  projectId: string,
  meetingId: string,
  index: number,
  status: string
) {
  return fetchApi(
    `/api/v1/projects/${projectId}/communications/meetings/${meetingId}/action-items/${index}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }
  );
}

// ── Agents ──
export function getAgentBrief(projectId: string) {
  return fetchApi(`/api/v1/projects/${projectId}/agents/brief`);
}

export function getRfiFollowUpDraft(
  projectId: string,
  rfiId: string,
  tone?: 'firm_professional' | 'collaborative' | 'urgent'
) {
  return fetchApi(`/api/v1/projects/${projectId}/agents/rfi-followup`, {
    method: 'POST',
    body: JSON.stringify({ rfiId, tone }),
  });
}

export function getCopilotAlerts(projectId: string) {
  return fetchApi(`/api/v1/projects/${projectId}/agents/copilot`);
}

export function getCoachTips(projectId: string) {
  return fetchApi(`/api/v1/projects/${projectId}/agents/coach`);
}

export function getStandardsChecks(projectId: string) {
  return fetchApi(`/api/v1/projects/${projectId}/agents/standards`);
}

export function getReporterDraft(projectId: string) {
  return fetchApi(`/api/v1/projects/${projectId}/agents/reporter`);
}

export function getIntelligence(projectId: string) {
  return fetchApi(`/api/v1/projects/${projectId}/agents/intelligence`);
}

// ── PDF downloads ──
// PDFs are returned as application/pdf. The browser-native download path
// (window.location.href) is simpler than fetch-then-blob for these endpoints
// because Content-Disposition handles the filename. We append the token as a
// query param so the Authorization header is unnecessary.
function withToken(path: string): string {
  const token = getToken();
  if (!token) return `${API_BASE}${path}`;
  const sep = path.includes('?') ? '&' : '?';
  return `${API_BASE}${path}${sep}token=${encodeURIComponent(token)}`;
}

export function getRfiPdfUrl(projectId: string, rfiId: string): string {
  return withToken(`/api/v1/projects/${projectId}/communications/rfis/${rfiId}/pdf`);
}

export function getSubmittalPdfUrl(projectId: string, submittalId: string): string {
  return withToken(`/api/v1/projects/${projectId}/communications/submittals/${submittalId}/pdf`);
}

export function getSubmittalLogPdfUrl(projectId: string): string {
  return withToken(`/api/v1/projects/${projectId}/communications/submittals/log/pdf`);
}

export function getChangeOrderPdfUrl(projectId: string, coId: string): string {
  return withToken(`/api/v1/projects/${projectId}/scope/change-orders/${coId}/pdf`);
}

export function getAsBuiltPdfUrl(projectId: string): string {
  return withToken(`/api/v1/projects/${projectId}/redlines/as-built-pdf`);
}
