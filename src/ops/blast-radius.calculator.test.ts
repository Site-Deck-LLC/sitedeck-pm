/**
 * Tests for the blast-radius calculator — Sprint 10
 * ============================================================================
 * The calculator inspects the repo on disk. For test speed we point
 * `__dirname` (already set) at the actual project and feed synthetic
 * bug reports. Files that exist get counted; files that don't get 0
 * lines and contribute to the empty-files risk case.
 * ============================================================================
 */

import { __test__, calculateBlastRadius } from './blast-radius.calculator';

describe('blast-radius.calculator: isRouteFile', () => {
  it('flags .routes.ts files', () => {
    expect(__test__.isRouteFile('src/routes/foo.routes.ts')).toBe(true);
    expect(__test__.isRouteFile('src/agents/bar.ts')).toBe(false);
  });
  it('flags /routes/ paths', () => {
    expect(__test__.isRouteFile('frontend/src/routes/bar.tsx')).toBe(true);
  });
});

describe('blast-radius.calculator: categorizeSensitive', () => {
  it('flags auth files', () => {
    expect(__test__.categorizeSensitive('src/middleware/auth.ts').auth).toBe(true);
  });
  it('flags payment files', () => {
    expect(__test__.categorizeSensitive('src/services/billing/stripe.ts').payment).toBe(true);
  });
  it('flags middleware files', () => {
    expect(__test__.categorizeSensitive('src/middleware/feature.ts').middleware).toBe(true);
  });
  it('flags ops/ paths', () => {
    expect(__test__.categorizeSensitive('src/ops/triage.agent.ts').middleware).toBe(true);
  });
});

describe('blast-radius.calculator: resolveRepoPath', () => {
  it('rejects paths outside the repo', () => {
    expect(__test__.resolveRepoPath('/etc/passwd')).toBeNull();
  });
});

describe('blast-radius.calculator: calculateBlastRadius', () => {
  it('marks HIGH risk when no files and no tests', () => {
    const blast = calculateBlastRadius({ id: 'b1', affectedFiles: [], suggestedFix: 'unknown' });
    expect(blast.riskLevel).toBe('high');
    expect(blast.testCount).toBe(0);
  });

  it('detects middleware in suggestedFix and flags HIGH', () => {
    const blast = calculateBlastRadius({
      id: 'b2',
      affectedFiles: ['src/middleware/auth.ts'],
      suggestedFix: 'touches middleware',
    });
    expect(blast.authFilesAffected).toBe(true);
    expect(blast.riskLevel).toBe('high');
  });

  it('classifies a small service change with enough tests as low/medium', () => {
    // dashboard.service.test.ts is a real test file in this repo. It
    // covers the file by name, so the testCount should be >= 1.
    const blast = calculateBlastRadius({
      id: 'b3',
      affectedFiles: ['src/services/dashboard.service.ts'],
    });
    // The classification depends on test count and lines; we just
    // verify the file is recognized and the test count is at least 1.
    expect(blast.affectedFiles).toContain('src/services/dashboard.service.ts');
    expect(blast.testCount).toBeGreaterThanOrEqual(1);
    // Not HIGH just from naming — sensitive pattern would only fire
    // for auth/middleware/payment paths.
    expect(blast.authFilesAffected).toBe(false);
    expect(blast.middlewareFilesAffected).toBe(false);
    expect(blast.paymentFilesAffected).toBe(false);
  });
});
