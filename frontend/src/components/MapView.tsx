import { useEffect, useState, useCallback, useRef } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
} from '@vis.gl/react-google-maps';
import { getProjectMapData } from '../api';
import { COLORS, FONTS, BORDERS, STATUS_COLORS } from '../styles/design-system';

interface ProjectMapItem {
  id: string;
  name: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  state: string | null;
  health: 'green' | 'amber' | 'red';
  cpi: number;
  spi: number;
  openItems: number;
  computedStatus: 'green' | 'amber' | 'red';
}

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

function HealthPin({ health }: { health: 'green' | 'amber' | 'red' }) {
  const color = STATUS_COLORS[health].bg;
  return (
    <Pin
      background={color}
      borderColor={COLORS.white}
      glyphColor={COLORS.white}
      scale={1.2}
    />
  );
}

function StatusBadge({ status }: { status: 'green' | 'amber' | 'red' }) {
  const labels: Record<typeof status, string> = {
    green: 'HEALTHY',
    amber: 'WARNING',
    red: 'CRITICAL',
  };
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.5px',
        textTransform: 'uppercase',
        background: STATUS_COLORS[status].bg + '20',
        color: STATUS_COLORS[status].bg,
        border: `1px solid ${STATUS_COLORS[status].bg}`,
      }}
    >
      {labels[status]}
    </span>
  );
}

function Divider() {
  return (
    <div
      style={{
        height: 1,
        background: COLORS.gray200,
        margin: '10px 0',
      }}
    />
  );
}

export function MapView({
  onBack,
  onSelectProject,
}: {
  onBack: () => void;
  onSelectProject: (id: string) => void;
}) {
  const [projects, setProjects] = useState<ProjectMapItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data: ProjectMapItem[] = await getProjectMapData();
        setProjects(data.filter((p) => p.latitude != null && p.longitude != null));
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleMarkerEnter = useCallback((id: string) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoveredId(id);
  }, []);

  const handleMarkerLeave = useCallback(() => {
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredId(null);
    }, 200);
  }, []);

  const handleMarkerClick = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  if (!API_KEY) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: COLORS.offWhite, gap: 16 }}>
        <div style={{ fontSize: FONTS.size.lg, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary }}>Map View</div>
        <div style={{ fontSize: FONTS.size.md, color: COLORS.textSecondary, textAlign: 'center', maxWidth: 480 }}>
          Google Maps API key is not configured.
          <br />
          Set <code>VITE_GOOGLE_MAPS_API_KEY</code> in your environment to enable the map.
        </div>
        <button
          onClick={onBack}
          style={{
            padding: '10px 20px',
            borderRadius: BORDERS.radius.md,
            border: 'none',
            background: COLORS.orange,
            color: COLORS.white,
            fontSize: FONTS.size.md,
            fontWeight: FONTS.weight.semibold,
            cursor: 'pointer',
          }}
        >
          Go Back
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: COLORS.offWhite }}>
        <div style={{ textAlign: 'center', color: COLORS.textSecondary }}>
          <div style={{ width: 40, height: 40, border: `3px solid ${COLORS.gray200}`, borderTop: `3px solid ${COLORS.orange}`, borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px' }} />
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          Loading map...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: COLORS.offWhite }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ color: COLORS.red, fontWeight: FONTS.weight.semibold, marginBottom: 16 }}>{error}</div>
          <button onClick={onBack} style={{ padding: '10px 20px', borderRadius: BORDERS.radius.md, border: 'none', background: COLORS.orange, color: COLORS.white, fontSize: FONTS.size.md, fontWeight: FONTS.weight.semibold, cursor: 'pointer' }}>
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Center on the first project, or default to US center
  const firstProject = projects[0];
  const defaultCenter = firstProject
    ? { lat: firstProject.latitude!, lng: firstProject.longitude! }
    : { lat: 39.8283, lng: -98.5795 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: COLORS.offWhite }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: COLORS.white,
          borderBottom: `1px solid ${COLORS.gray200}`,
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          zIndex: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={onBack}
            style={{
              padding: '8px 14px',
              borderRadius: BORDERS.radius.md,
              border: `1px solid ${COLORS.gray200}`,
              background: COLORS.white,
              color: COLORS.textPrimary,
              fontSize: FONTS.size.sm,
              fontWeight: FONTS.weight.semibold,
              cursor: 'pointer',
            }}
          >
            ← Back
          </button>
          <span style={{ fontSize: FONTS.size.md, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary }}>Project Map</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: FONTS.size.xs, color: COLORS.textSecondary }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLORS.green.bg }} />
            <span>Healthy</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLORS.amber.bg }} />
            <span>Warning</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: STATUS_COLORS.red.bg }} />
            <span>Critical</span>
          </div>
        </div>
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative' }}>
        <APIProvider apiKey={API_KEY}>
          <Map
            defaultCenter={defaultCenter}
            defaultZoom={4}
            gestureHandling="greedy"
            disableDefaultUI={false}
            mapId="sitedeck-map"
            style={{ width: '100%', height: '100%' }}
          >
            {projects.map((p) => (
              <AdvancedMarker
                key={p.id}
                position={{ lat: p.latitude!, lng: p.longitude! }}
                onClick={() => handleMarkerClick(p.id)}
              >
                <div
                  onMouseEnter={() => handleMarkerEnter(p.id)}
                  onMouseLeave={handleMarkerLeave}
                  style={{ cursor: 'pointer' }}
                >
                  <HealthPin health={p.health} />
                </div>
              </AdvancedMarker>
            ))}

            {(selectedId || hoveredId) && (
              <InfoWindow
                position={{
                  lat: projects.find((p) => p.id === (selectedId || hoveredId))?.latitude ?? 0,
                  lng: projects.find((p) => p.id === (selectedId || hoveredId))?.longitude ?? 0,
                }}
                onCloseClick={() => {
                  setSelectedId(null);
                  setHoveredId(null);
                }}
              >
                {(() => {
                  const activeId = selectedId || hoveredId;
                  const p = projects.find((proj) => proj.id === activeId);
                  if (!p) return null;
                  return (
                    <div
                      onMouseEnter={() => {
                        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                      }}
                      onMouseLeave={handleMarkerLeave}
                    >
                      <div style={{ minWidth: 240, fontFamily: FONTS.family, padding: 4 }}>
                        {/* Project name */}
                        <div style={{ fontSize: FONTS.size.sm, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, marginBottom: 4, lineHeight: 1.3 }}>
                        {p.name}
                      </div>

                      {/* City, State */}
                      <div style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary, marginBottom: 8 }}>
                        {p.city ? `${p.city}, ${p.state || ''}` : 'Location not set'}
                      </div>

                      <Divider />

                      {/* CPI / SPI */}
                      <div style={{ display: 'flex', gap: 16, marginBottom: 8 }}>
                        <div>
                          <span style={{ fontSize: 11, color: COLORS.textMuted }}>CPI: </span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: p.cpi >= 1.0 ? COLORS.green : p.cpi >= 0.95 ? COLORS.amber : COLORS.red }}>
                            {p.cpi.toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span style={{ fontSize: 11, color: COLORS.textMuted }}>SPI: </span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: p.spi >= 1.0 ? COLORS.green : p.spi >= 0.9 ? COLORS.amber : COLORS.red }}>
                            {p.spi.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Open Items */}
                      <div style={{ marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: COLORS.textMuted }}>Open Items: </span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: p.openItems > 0 ? COLORS.amber : COLORS.green }}>
                          {p.openItems}
                        </span>
                      </div>

                      <Divider />

                      {/* Status badge + button */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <StatusBadge status={p.computedStatus} />
                        <button
                          onClick={() => onSelectProject(p.id)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: BORDERS.radius.md,
                            border: 'none',
                            background: COLORS.orange,
                            color: COLORS.white,
                            fontSize: 10,
                            fontWeight: FONTS.weight.semibold,
                            cursor: 'pointer',
                          }}
                        >
                          Open Dashboard
                        </button>
                      </div>
                    </div>
                  </div>
                  );
                })()}
              </InfoWindow>
            )}
          </Map>
        </APIProvider>
      </div>
    </div>
  );
}
