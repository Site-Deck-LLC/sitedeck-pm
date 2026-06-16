// Returns the current dev/seed role for the browser session.
// In V1 we read it from the dev token in the URL or localStorage. In production
// (Task 8 — Firebase Auth) this will read the Firebase custom claim instead.
const ROLE_KEY = 'sitedeck-role';

export function setCurrentRole(role: string) {
  localStorage.setItem(ROLE_KEY, role);
}

export function getCurrentRole(): string {
  return localStorage.getItem(ROLE_KEY) || 'project_manager';
}

export function canEditSchedule(): boolean {
  const r = getCurrentRole();
  return r === 'owner_admin' || r === 'project_manager';
}

export function canEditIssues(): boolean {
  return canEditSchedule();
}
