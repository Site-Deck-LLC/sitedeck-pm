/**
 * BenchmarkActivity component
 * ============================================================================
 * Sprint 13: shows the last 10 Benchmark events for this project.
 * Reads from GET /api/v1/projects/:id/benchmark-activity.
 * ============================================================================
 */

import { useEffect, useState } from 'react';
import { COLORS, FONTS, BORDERS } from '../styles/design-system';
import { getBenchmarkActivity } from '../api';

interface BenchmarkEvent {
  id: string;
  type: string;
  description: string;
  timestamp: string;
}

export function BenchmarkActivity({ projectId }: { projectId: string }) {
  const [events, setEvents] = useState<BenchmarkEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const data = await getBenchmarkActivity(projectId);
        setEvents(data.events || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [projectId]);

  if (loading) {
    return (
      <div style={{ padding: '16px 0', color: COLORS.textSecondary, fontSize: FONTS.size.sm }}>
        Loading Benchmark activity…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '16px 0', color: COLORS.red, fontSize: FONTS.size.sm }}>
        Could not load Benchmark activity.
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div style={emptyStateStyle}>
        <div style={{ color: COLORS.gray300, marginBottom: 12 }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" />
          </svg>
        </div>
        <div style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary, lineHeight: 1.4 }}>
          No Benchmark activity yet — link activities to start syncing
        </div>
      </div>
    );
  }

  const typeLabel = (type: string): string => {
    const map: Record<string, string> = {
      benchmark_inspection_completed: 'Inspection Completed',
      benchmark_ncr_opened: 'NCR Opened',
      benchmark_hold_point_released: 'Hold Point Released',
      benchmark_daily_report_posted: 'Daily Report Posted',
      benchmark_qcp_exported: 'QCP Exported',
    };
    return map[type] || type.replace(/_/g, ' ');
  };

  const typeColor = (type: string): string => {
    if (type.includes('inspection')) return COLORS.green;
    if (type.includes('ncr')) return COLORS.red;
    if (type.includes('hold')) return COLORS.amber;
    if (type.includes('daily')) return COLORS.navy;
    return COLORS.textSecondary;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {events.map((evt) => (
        <div
          key={evt.id}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '10px 12px',
            background: COLORS.offWhite,
            borderRadius: BORDERS.radius.sm,
            borderLeft: `3px solid ${typeColor(evt.type)}`,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: FONTS.size.xs, fontWeight: FONTS.weight.semibold, color: typeColor(evt.type), textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: 2 }}>
              {typeLabel(evt.type)}
            </div>
            <div style={{ fontSize: FONTS.size.sm, color: COLORS.textPrimary, lineHeight: 1.3 }}>
              {evt.description}
            </div>
            <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, marginTop: 2 }}>
              {new Date(evt.timestamp).toLocaleString()}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const emptyStateStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '32px 16px',
  textAlign: 'center',
  color: COLORS.textMuted,
};
