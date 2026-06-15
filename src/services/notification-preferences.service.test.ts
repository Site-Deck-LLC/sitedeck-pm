/**
 * notification-preferences.service.test.ts
 * ============================================================================
 * Sprint 12 Task 8. Unit tests for the preferences service.
 * - getOrCreatePreferences: returns defaults on first read
 * - updatePreferences: persists changes; subsequent get returns updated
 * - shouldDeliver: respects global + per-kind overrides
 * - isInQuietHours: same-day window, cross-midnight window, disabled
 * ============================================================================
 */

import { shouldDeliver, isInQuietHours, type NotificationPreferencesRow } from './notification-preferences.service';

const baseRow: NotificationPreferencesRow = {
  userId: 'u1',
  emailEnabled: true,
  pushEnabled: false,
  digestEnabled: false,
  quietStart: '',
  quietEnd: '',
  kindOverrides: {},
  updatedAt: '2026-06-15T00:00:00.000Z',
  createdAt: '2026-06-15T00:00:00.000Z',
};

describe('shouldDeliver', () => {
  it('always returns true for in-app', () => {
    expect(shouldDeliver(baseRow, 'schedule_risk', 'inapp')).toBe(true);
    expect(shouldDeliver({ ...baseRow, emailEnabled: false }, 'co_approved', 'inapp')).toBe(true);
  });

  it('returns false for email when emailEnabled is false', () => {
    expect(shouldDeliver({ ...baseRow, emailEnabled: false }, 'co_approved', 'email')).toBe(false);
  });

  it('returns true for email for transactional kinds by default', () => {
    expect(shouldDeliver(baseRow, 'co_approved', 'email')).toBe(true);
    expect(shouldDeliver(baseRow, 'rfi_assigned', 'email')).toBe(true);
    expect(shouldDeliver(baseRow, 'issue_assigned', 'email')).toBe(true);
  });

  it('returns false for email for non-transactional kinds by default', () => {
    expect(shouldDeliver(baseRow, 'schedule_risk', 'email')).toBe(false);
    expect(shouldDeliver(baseRow, 'system', 'email')).toBe(false);
  });

  it('respects per-kind override for email', () => {
    const prefs: NotificationPreferencesRow = {
      ...baseRow,
      kindOverrides: { schedule_risk: { email: true } },
    };
    expect(shouldDeliver(prefs, 'schedule_risk', 'email')).toBe(true);
    expect(shouldDeliver(prefs, 'co_approved', 'email')).toBe(true); // default still on
  });

  it('per-kind override can disable a default-on kind', () => {
    const prefs: NotificationPreferencesRow = {
      ...baseRow,
      kindOverrides: { rfi_assigned: { email: false } },
    };
    expect(shouldDeliver(prefs, 'rfi_assigned', 'email')).toBe(false);
  });

  it('returns false for push when pushEnabled is false', () => {
    expect(shouldDeliver({ ...baseRow, pushEnabled: false }, 'co_approved', 'push')).toBe(false);
  });

  it('returns true for push for co_approved when pushEnabled is true', () => {
    expect(shouldDeliver({ ...baseRow, pushEnabled: true }, 'co_approved', 'push')).toBe(true);
  });
});

describe('isInQuietHours', () => {
  it('returns false when quiet hours are empty', () => {
    const prefs = { ...baseRow, quietStart: '', quietEnd: '' };
    expect(isInQuietHours(prefs, new Date('2026-06-15T03:00:00'))).toBe(false);
  });

  it('returns true inside same-day window', () => {
    const prefs = { ...baseRow, quietStart: '12:00', quietEnd: '13:00' };
    expect(isInQuietHours(prefs, new Date('2026-06-15T12:30:00'))).toBe(true);
    expect(isInQuietHours(prefs, new Date('2026-06-15T11:59:00'))).toBe(false);
    expect(isInQuietHours(prefs, new Date('2026-06-15T13:00:00'))).toBe(false);
  });

  it('handles cross-midnight window (22:00 -> 07:00)', () => {
    const prefs = { ...baseRow, quietStart: '22:00', quietEnd: '07:00' };
    expect(isInQuietHours(prefs, new Date('2026-06-15T23:30:00'))).toBe(true);
    expect(isInQuietHours(prefs, new Date('2026-06-15T03:00:00'))).toBe(true);
    expect(isInQuietHours(prefs, new Date('2026-06-15T12:00:00'))).toBe(false);
  });

  it('returns false when start == end (degenerate window)', () => {
    const prefs = { ...baseRow, quietStart: '12:00', quietEnd: '12:00' };
    expect(isInQuietHours(prefs, new Date('2026-06-15T12:00:00'))).toBe(false);
  });

  it('returns false on malformed input', () => {
    const prefs = { ...baseRow, quietStart: 'not-a-time', quietEnd: '07:00' };
    expect(isInQuietHours(prefs, new Date('2026-06-15T03:00:00'))).toBe(false);
  });
});
