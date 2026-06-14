/**
 * ops/blast-radius.calculator.ts — Sprint 10, Task 4
 * ============================================================================
 * Estimates the scope of a proposed code change so an operator can
 * decide whether to approve the auto-fix. The calculator inspects the
 * set of files the triage agent flagged, counts lines, finds tests that
 * cover them, and emits a risk level.
 *
 * Risk policy:
 *   LOW    : <= 3 files, >= 20 tests covering them, no route/middleware
 *   MEDIUM : 4-8 files, OR < 20 tests, OR route files affected
 *   HIGH   : > 8 files, OR < 5 tests, OR middleware/auth/payment files
 *
 * The risk policy is intentionally conservative. Sprint 10's job is to
 * keep the operator in the loop; later sprints can relax LOW risk to
 * auto-approve trivial fixes.
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';

export type RiskLevel = 'low' | 'medium' | 'high';
export type Complexity = 'simple' | 'moderate' | 'complex';

export interface BlastRadius {
  affectedFiles: string[];
  testCount: number;
  riskLevel: RiskLevel;
  routeFilesAffected: boolean;
  authFilesAffected: boolean;
  paymentFilesAffected: boolean;
  middlewareFilesAffected: boolean;
  totalLines: number;
  estimatedFixComplexity: Complexity;
}

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

const SENSITIVE_PATH_PATTERNS = [
  /middleware/i,
  /auth/i,
  /payment/i,
  /billing/i,
  /stripe/i,
  /byok/i,
  /ops\//i,
  /admin/i,
];

const ROUTE_PATH_PATTERNS = [
  /\/routes\//i,
  /\.routes\.ts$/i,
];

function isRouteFile(p: string): boolean {
  return ROUTE_PATH_PATTERNS.some((re) => re.test(p));
}

function isSensitiveFile(p: string): boolean {
  return SENSITIVE_PATH_PATTERNS.some((re) => re.test(p));
}

function categorizeSensitive(p: string): {
  auth: boolean;
  payment: boolean;
  middleware: boolean;
} {
  const lc = p.toLowerCase();
  return {
    auth: /auth|firebase|byok/.test(lc),
    payment: /payment|billing|stripe/.test(lc),
    middleware: /middleware|ops\/|admin/.test(lc),
  };
}

function countLines(absPath: string): number {
  try {
    const content = fs.readFileSync(absPath, 'utf8');
    return content.split('\n').length;
  } catch {
    return 0;
  }
}

function resolveRepoPath(rel: string): string | null {
  // Accept "src/services/foo.ts", "frontend/src/...", and absolute paths.
  const abs = path.isAbsolute(rel) ? rel : path.join(PROJECT_ROOT, rel);
  if (!abs.startsWith(PROJECT_ROOT)) return null;
  return abs;
}

function findTestFilesFor(sourceAbsPath: string): string[] {
  const tests: string[] = [];
  const rel = path.relative(PROJECT_ROOT, sourceAbsPath);
  const baseName = path.basename(rel, path.extname(rel));

  // Walk the test tree once and pick up anything that imports or names
  // the source file. Bounded scan: we look at `__tests__` directories
  // and any `*.test.ts` next to the source.
  const candidates: string[] = [];
  const queue = [path.dirname(sourceAbsPath)];
  const seen = new Set<string>();
  while (queue.length && candidates.length < 200) {
    const dir = queue.shift()!;
    if (seen.has(dir)) continue;
    seen.add(dir);
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === 'dist' || e.name.startsWith('.')) continue;
        queue.push(full);
      } else if (e.isFile() && (e.name.endsWith('.test.ts') || e.name.endsWith('.spec.ts'))) {
        candidates.push(full);
      }
    }
  }

  for (const testFile of candidates) {
    let content: string;
    try {
      content = fs.readFileSync(testFile, 'utf8');
    } catch {
      continue;
    }
    if (content.includes(baseName) || content.includes(rel) || content.includes(path.basename(rel))) {
      tests.push(path.relative(PROJECT_ROOT, testFile));
    }
  }
  return tests;
}

export function calculateBlastRadius(bugReport: {
  id: string;
  affectedFiles?: string[];
  suggestedFix?: string;
}): BlastRadius {
  const files = Array.isArray(bugReport.affectedFiles) ? bugReport.affectedFiles : [];

  // If the agent didn't list files, derive candidates from the
  // suggestedFix text. We look for src/ or frontend/src/ paths.
  let resolvedFiles: { rel: string; abs: string; lines: number; tests: string[] }[] = [];
  if (files.length === 0 && bugReport.suggestedFix) {
    const matches = bugReport.suggestedFix.match(/(?:src|frontend\/src|prisma)\/[a-zA-Z0-9_./-]+\.(?:ts|tsx|prisma)/g) || [];
    for (const m of matches) {
      const abs = resolveRepoPath(m);
      if (!abs) continue;
      resolvedFiles.push({ rel: m, abs, lines: countLines(abs), tests: findTestFilesFor(abs) });
    }
  } else {
    for (const f of files) {
      const abs = resolveRepoPath(f);
      if (!abs) continue;
      resolvedFiles.push({ rel: f, abs, lines: countLines(abs), tests: findTestFilesFor(abs) });
    }
  }

  const allTests = new Set<string>();
  for (const f of resolvedFiles) {
    for (const t of f.tests) allTests.add(t);
  }

  const routeFilesAffected = resolvedFiles.some((f) => isRouteFile(f.rel));
  let authFilesAffected = false;
  let paymentFilesAffected = false;
  let middlewareFilesAffected = false;
  for (const f of resolvedFiles) {
    const cat = categorizeSensitive(f.rel);
    if (cat.auth) authFilesAffected = true;
    if (cat.payment) paymentFilesAffected = true;
    if (cat.middleware) middlewareFilesAffected = true;
  }
  // Even if the affected file list is empty, treat any of the patterns
  // in the suggestedFix text as flags (the operator can confirm in the UI).
  if (bugReport.suggestedFix) {
    if (/middleware/i.test(bugReport.suggestedFix)) middlewareFilesAffected = true;
    if (/auth|firebase/i.test(bugReport.suggestedFix)) authFilesAffected = true;
    if (/payment|billing|stripe/i.test(bugReport.suggestedFix)) paymentFilesAffected = true;
  }

  const fileCount = resolvedFiles.length;
  const testCount = allTests.size;
  const totalLines = resolvedFiles.reduce((sum, f) => sum + f.lines, 0);

  let riskLevel: RiskLevel;
  if (fileCount > 8 || testCount < 5 || authFilesAffected || paymentFilesAffected || middlewareFilesAffected) {
    riskLevel = 'high';
  } else if (fileCount >= 4 || testCount < 20 || routeFilesAffected) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'low';
  }

  let estimatedFixComplexity: Complexity;
  if (fileCount <= 2 && totalLines < 200) estimatedFixComplexity = 'simple';
  else if (fileCount <= 6 && totalLines < 800) estimatedFixComplexity = 'moderate';
  else estimatedFixComplexity = 'complex';

  return {
    affectedFiles: resolvedFiles.map((f) => f.rel),
    testCount,
    riskLevel,
    routeFilesAffected,
    authFilesAffected,
    paymentFilesAffected,
    middlewareFilesAffected,
    totalLines,
    estimatedFixComplexity,
  };
}

export const __test__ = {
  isRouteFile,
  isSensitiveFile,
  categorizeSensitive,
  resolveRepoPath,
  SENSITIVE_PATH_PATTERNS,
};
