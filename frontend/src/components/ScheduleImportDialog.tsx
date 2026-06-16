import { useState, useRef, useCallback } from 'react';
import { importXer, importMsProject, importExcelSchedule } from '../api';
import { COLORS, FONTS, SHADOWS, BORDERS } from '../styles/design-system';

type ImportType = 'xer' | 'msproject' | 'excel';

const IMPORT_TYPES: { key: ImportType; label: string; ext: string; accept: string; description: string }[] = [
  { key: 'xer', label: 'Primavera P6 XER', ext: '.xer', accept: '.xer', description: 'Export from P6: File → Export → XER format' },
  { key: 'msproject', label: 'MS Project XML', ext: '.xml', accept: '.xml', description: 'Export from Project: File → Save As → XML Format' },
  { key: 'excel', label: 'Excel / CSV', ext: '.xlsx, .csv', accept: '.xlsx,.csv', description: 'Spreadsheet with columns: Name, Start Date, End Date, Duration' },
];

export function ScheduleImportDialog({
  projectId,
  onClose,
  onSuccess,
}: {
  projectId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [importType, setImportType] = useState<ImportType>('xer');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    importedActivities: number;
    importedRelationships: number;
    importedWbsItems: number;
    projectName?: string;
  } | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setError('');
    setResult(null);
  }, []);

  const handleImport = useCallback(async () => {
    if (!file) {
      setError('Please select a file');
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      let res;
      switch (importType) {
        case 'xer':
          res = await importXer(projectId, file);
          break;
        case 'msproject':
          res = await importMsProject(projectId, file);
          break;
        case 'excel':
          res = await importExcelSchedule(projectId, file);
          break;
      }
      setResult({
        importedActivities: res.importedActivities || 0,
        importedRelationships: res.importedRelationships || 0,
        importedWbsItems: res.importedWbsItems || 0,
        projectName: res.xerProjectName || res.mspProjectName,
      });
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Import failed');
    } finally {
      setLoading(false);
    }
  }, [file, importType, projectId, onSuccess]);

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: FONTS.size.lg, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary }}>
            Import Schedule
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: COLORS.textSecondary }}>
            ×
          </button>
        </div>

        {result ? (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>✅</div>
              <h3 style={{ margin: '0 0 8px', fontSize: FONTS.size.md, color: COLORS.textPrimary }}>
                Import Complete
              </h3>
              {result.projectName && (
                <p style={{ margin: 0, color: COLORS.textSecondary, fontSize: FONTS.size.sm }}>
                  {result.projectName}
                </p>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
              <div style={resultCardStyle}>
                <div style={{ fontSize: FONTS.size.display, fontWeight: FONTS.weight.bold, color: COLORS.orange }}>
                  {result.importedActivities}
                </div>
                <div style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary, textTransform: 'uppercase', fontWeight: FONTS.weight.semibold }}>
                  Activities
                </div>
              </div>
              <div style={resultCardStyle}>
                <div style={{ fontSize: FONTS.size.display, fontWeight: FONTS.weight.bold, color: COLORS.orange }}>
                  {result.importedRelationships}
                </div>
                <div style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary, textTransform: 'uppercase', fontWeight: FONTS.weight.semibold }}>
                  Relationships
                </div>
              </div>
              <div style={resultCardStyle}>
                <div style={{ fontSize: FONTS.size.display, fontWeight: FONTS.weight.bold, color: COLORS.orange }}>
                  {result.importedWbsItems}
                </div>
                <div style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary, textTransform: 'uppercase', fontWeight: FONTS.weight.semibold }}>
                  WBS Items
                </div>
              </div>
            </div>

            <button onClick={onClose} style={primaryButtonStyle}>
              Done
            </button>
          </div>
        ) : (
          <div>
            {/* Import type selector */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {IMPORT_TYPES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => { setImportType(t.key); setFile(null); setError(''); }}
                  style={typeButtonStyle(importType === t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <p style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary, marginBottom: 16 }}>
              {IMPORT_TYPES.find((t) => t.key === importType)?.description}
            </p>

            {/* File drop zone */}
            <div
              style={dropZoneStyle}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={IMPORT_TYPES.find((t) => t.key === importType)?.accept}
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              {file ? (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: FONTS.size.md, fontWeight: FONTS.weight.semibold, color: COLORS.textPrimary, marginBottom: 4 }}>
                    {file.name}
                  </div>
                  <div style={{ fontSize: FONTS.size.xs, color: COLORS.textSecondary }}>
                    {(file.size / 1024).toFixed(1)} KB
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                  <div style={{ fontSize: FONTS.size.sm, color: COLORS.textSecondary }}>
                    Click to upload or drag & drop
                  </div>
                  <div style={{ fontSize: FONTS.size.xs, color: COLORS.textMuted, marginTop: 4 }}>
                    Accepts: {IMPORT_TYPES.find((t) => t.key === importType)?.ext}
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div style={{ marginTop: 12, padding: 10, borderRadius: BORDERS.radius.md, background: COLORS.redLight, color: COLORS.red, fontSize: FONTS.size.sm }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
              <button onClick={onClose} style={secondaryButtonStyle}>
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={!file || loading}
                style={primaryButtonStyle}
              >
                {loading ? 'Importing…' : 'Import'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0,0,0,0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: 24,
};

const dialogStyle: React.CSSProperties = {
  background: COLORS.white,
  borderRadius: BORDERS.radius.lg,
  boxShadow: SHADOWS.xl,
  width: '100%',
  maxWidth: 560,
  maxHeight: '90vh',
  overflow: 'auto',
  padding: 24,
};

const dropZoneStyle: React.CSSProperties = {
  border: `2px dashed ${COLORS.gray300}`,
  borderRadius: BORDERS.radius.md,
  padding: '32px 24px',
  cursor: 'pointer',
  transition: 'border-color 0.15s',
};

function typeButtonStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '10px 12px',
    borderRadius: BORDERS.radius.md,
    border: active ? `2px solid ${COLORS.orange}` : `1px solid ${COLORS.gray200}`,
    background: active ? '#FFF3E0' : COLORS.white,
    color: active ? COLORS.orange : COLORS.textSecondary,
    fontSize: FONTS.size.sm,
    fontWeight: active ? FONTS.weight.semibold : FONTS.weight.medium,
    cursor: 'pointer',
    transition: 'all 0.15s',
  };
}

const primaryButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: '10px 16px',
  borderRadius: BORDERS.radius.md,
  border: 'none',
  background: COLORS.orange,
  color: COLORS.white,
  fontSize: FONTS.size.md,
  fontWeight: FONTS.weight.semibold,
  cursor: 'pointer',
};

const secondaryButtonStyle: React.CSSProperties = {
  flex: 1,
  padding: '10px 16px',
  borderRadius: BORDERS.radius.md,
  border: `1px solid ${COLORS.gray200}`,
  background: COLORS.white,
  color: COLORS.textSecondary,
  fontSize: FONTS.size.md,
  fontWeight: FONTS.weight.semibold,
  cursor: 'pointer',
};

const resultCardStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: 16,
  borderRadius: BORDERS.radius.md,
  background: COLORS.offWhite,
  border: `1px solid ${COLORS.gray200}`,
};
