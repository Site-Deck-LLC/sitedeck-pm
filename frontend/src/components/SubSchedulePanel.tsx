/**
 * Sub-Schedule Rollup Panel
 * ============================================================================
 * Sprint 12 Task 6. Collapsible panel that lists one row per
 * subcontract with its sub-SPI. Expand reveals the activity list.
 * Sits below the Gantt on the Schedule page.
 * ============================================================================
 */

import { useEffect, useState } from 'react';
import { fetchApi } from '../api';
import { COLORS, FONTS, BORDERS } from '../styles/design-system';

interface SubRollup {
  subcontractId: string;
  subcontractorName: string;
  spi: number;
  status: 'ahead' | 'on_track' | 'at_risk';
  completePct: number;
  activityCount: number;
}

interface SubScheduleActivity {
  id: string;
  name: string;
  status: string;
  percentComplete: number;
  plannedStart: string | null;
  plannedEnd: string | null;
}

interface SubScheduleDetail {
  id: string;
  name: string;
  activities: SubScheduleActivity[];
  spi: { spi: number; status: string };
}

const STATUS_COLORS: Record<SubRollup['status'], string> = {
  ahead: COLORS.green,
  on_track: COLORS.navy,
  at_risk: COLORS.red,
};

export function SubSchedulePanel({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<SubRollup[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<SubScheduleDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await fetchApi<SubRollup[]>(
          `/api/v1/projects/${projectId}/sub-schedules/rollup`
        );
        setRows(r);
      } catch (e: any) {
        setError(e?.message || 'failed to load');
        setRows([]);
      }
    })();
  }, [projectId]);

  const toggle = async (subId: string) => {
    if (expanded === subId) {
      setExpanded(null);
      setDetail(null);
      return;
    }
    setExpanded(subId);
    try {
      const d = await fetchApi<SubScheduleDetail>(
        `/api/v1/projects/${projectId}/sub-schedules/${subId}`
      );
      setDetail(d);
    } catch (e: any) {
      setError(e?.message || 'failed to load detail');
    }
  };

  return (
    <div
      style={{
        background: COLORS.white,
        border: `1px solid ${COLORS.gray200}`,
        borderRadius: BORDERS.radius.md,
        padding: 16,
        marginTop: 16,
      }}
    >
      <h3 style={{ margin: 0, marginBottom: 8, color: COLORS.navy, fontSize: FONTS.size.md }}>
        Subcontract Schedules
      </h3>
      {error && <p style={{ color: COLORS.red, fontSize: FONTS.size.sm }}>{error}</p>}
      {rows === null && <p style={{ color: COLORS.textMuted }}>Loading…</p>}
      {rows && rows.length === 0 && (
        <p style={{ color: COLORS.textMuted, fontSize: FONTS.size.sm }}>
          No subcontracts have sub-schedules yet.
        </p>
      )}
      {rows && rows.length > 0 && (
        <div>
          {rows.map((r) => (
            <div
              key={r.subcontractId}
              style={{
                borderTop: `1px solid ${COLORS.gray200}`,
                padding: '8px 0',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'pointer',
                }}
                onClick={() => toggle(r.subcontractId)}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: STATUS_COLORS[r.status],
                    display: 'inline-block',
                  }}
                />
                <span style={{ flex: 1, fontSize: FONTS.size.sm, color: COLORS.textPrimary }}>
                  {r.subcontractorName}
                </span>
                <span
                  style={{
                    fontSize: FONTS.size.xs,
                    color: STATUS_COLORS[r.status],
                    fontWeight: FONTS.weight.semibold,
                  }}
                >
                  SPI {r.spi.toFixed(2)}
                </span>
                <span style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted }}>
                  {r.activityCount} activities
                </span>
                <span style={{ color: COLORS.textMuted, fontSize: FONTS.size.xs }}>
                  {expanded === r.subcontractId ? '▾' : '▸'}
                </span>
              </div>
              {expanded === r.subcontractId && detail && (
                <div style={{ paddingLeft: 20, marginTop: 8 }}>
                  {detail.activities.length === 0 && (
                    <p style={{ color: COLORS.textMuted, fontSize: FONTS.size.xs }}>
                      No activities yet.
                    </p>
                  )}
                  {detail.activities.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: FONTS.size.xs,
                        color: COLORS.textSecondary,
                        padding: '3px 0',
                      }}
                    >
                      <span style={{ flex: 1 }}>{a.name}</span>
                      <div
                        style={{
                          width: 80,
                          height: 6,
                          background: COLORS.gray200,
                          borderRadius: 3,
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.min(100, a.percentComplete)}%`,
                            height: '100%',
                            background: COLORS.orange,
                            borderRadius: 3,
                          }}
                        />
                      </div>
                      <span style={{ width: 32, textAlign: 'right' }}>{a.percentComplete}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
