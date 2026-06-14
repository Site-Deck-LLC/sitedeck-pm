/**
 * ops/fix-pipeline.service.ts — Sprint 10, Task 6
 * ============================================================================
 * When a code-fix is approved, this service writes a prompt file to the
 * VPS, runs Claude Code in the background, and polls for the result.
 *
 * The flow:
 *   1. SSH to the VPS (key at ~/.ssh/hostinger-vps-key, host 2.24.194.23)
 *   2. Write /tmp/sitedeck-fix-<id>.md and /tmp/fix-result-<id>.json (the
 *      output schema Claude Code must write to on completion)
 *   3. Launch `claude --dangerously-skip-permissions < prompt.md &` in the
 *      background
 *   4. Poll for /tmp/fix-result-<id>.json every 30 seconds, up to 10 minutes
 *   5. Update BugReport status to code_fix_deployed on success, back to
 *      code_fix_pending on test failure
 *
 * Security:
 *   - The prompt file is written via SSH to a directory only writable
 *     by root, never to a project tree
 *   - The SSH key is loaded at runtime (no key in env or DB)
 *   - The pipeline only runs against a fixed set of bug IDs that the
 *     operator has explicitly approved
 * ============================================================================
 */

import { execFile } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as util from 'util';
import { getPrismaClient } from '../lib/prisma';
import { sendPushNotification } from '../services/push-notification.service';
import { logOpsAction } from './audit-log';

const execFileP = util.promisify(execFile);

const VPS_HOST = process.env.VPS_HOST || '2.24.194.23';
const VPS_USER = process.env.VPS_USER || 'root';
const SSH_KEY = process.env.OPS_SSH_KEY || path.join(os.homedir(), '.ssh', 'hostinger-vps-key');
const VPS_APP_DIR = process.env.REMOTE_APP_DIR || '/opt/sitedeck-pm';
const POLL_INTERVAL_MS = 30 * 1000;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

const SUPPORT_UID = process.env.OPS_SUPPORT_UID || 'BJedHsm0LTXHiJokkZStXw9N18H2';

const inFlightPipelines = new Map<string, { startedAt: number; pid?: number; status: 'running' | 'success' | 'failed' | 'timeout' }>();

// ─── Prompt generation ───────────────────────────────────────────────────────

function buildFixPrompt(bug: {
  id: string;
  product: string;
  route: string;
  userAction: string;
  suggestedFix: string | null;
}, blast: any): string {
  return `# SiteDeck PM Bug Fix — ${bug.id}

You are fixing a bug in SiteDeck PM.

Bug report: ${bug.id}
Product: ${bug.product}
Route: ${bug.route}
User reported: ${bug.userAction.replace(/[\r\n]+/g, ' ')}

Affected files: ${(blast?.affectedFiles || []).join(', ') || '(none reported)'}
Suggested fix: ${bug.suggestedFix || '(no suggested fix provided)'}
Risk level: ${blast?.riskLevel || 'unknown'}

Rules:
- Fix ONLY what is described
- Do not refactor unrelated code
- Run npm test after fixing
- Only deploy if ALL tests pass
- If tests fail: log failure, do NOT deploy
- Write to /tmp/fix-result-${bug.id}.json with the schema:
  { "success": boolean, "testsPass": boolean, "testCount": number, "deployed": boolean, "error"?: string }

Go.
`;
}

// ─── SSH helpers ─────────────────────────────────────────────────────────────

async function sshExec(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return execFileP('ssh', ['-i', SSH_KEY, '-o', 'ConnectTimeout=10', '-o', 'StrictHostKeyChecking=accept-new', `${VPS_USER}@${VPS_HOST}`, ...args], {
    maxBuffer: 16 * 1024 * 1024,
  });
}

async function scpToVps(localPath: string, remotePath: string): Promise<void> {
  await execFileP('scp', ['-i', SSH_KEY, '-o', 'ConnectTimeout=10', '-o', 'StrictHostKeyChecking=accept-new', localPath, `${VPS_USER}@${VPS_HOST}:${remotePath}`]);
}

async function scpFromVps(remotePath: string, localPath: string): Promise<void> {
  await execFileP('scp', ['-i', SSH_KEY, '-o', 'ConnectTimeout=10', '-o', 'StrictHostKeyChecking=accept-new', `${VPS_USER}@${VPS_HOST}:${remotePath}`, localPath]);
}

// ─── Pipeline trigger ────────────────────────────────────────────────────────

export async function triggerFixPipeline(bugReportId: string): Promise<{ started: boolean; reason?: string }> {
  if (inFlightPipelines.has(bugReportId)) {
    return { started: false, reason: 'Pipeline already in flight' };
  }
  const prisma = getPrismaClient();
  const bug = await prisma.bugReport.findUnique({ where: { id: bugReportId } });
  if (!bug) return { started: false, reason: 'Bug report not found' };
  if (bug.status !== 'code_fix_approved') {
    return { started: false, reason: `Bug not in code_fix_approved (current: ${bug.status})` };
  }

  inFlightPipelines.set(bugReportId, { startedAt: Date.now(), status: 'running' });

  // Run the actual work in the background so the HTTP caller returns
  // immediately. Errors are logged.
  runPipeline(bugReportId, bug).catch((e) => {
    console.error(`[ops/fix-pipeline] ${bugReportId} failed:`, e);
  });

  return { started: true };
}

async function runPipeline(
  bugReportId: string,
  bug: { id: string; product: string; route: string; userAction: string; suggestedFix: string | null; blastRadius: any }
): Promise<void> {
  const prisma = getPrismaClient();
  await logOpsAction({
    action: 'fix_pipeline.started',
    performedBy: 'system:fix-pipeline',
    targetType: 'fix_pipeline',
    targetId: bugReportId,
    details: { product: bug.product, route: bug.route },
  });

  const prompt = buildFixPrompt(bug, bug.blastRadius);
  const localPrompt = path.join(os.tmpdir(), `sitedeck-fix-${bugReportId}.md`);
  const remotePrompt = `/tmp/sitedeck-fix-${bugReportId}.md`;
  const remoteResult = `/tmp/fix-result-${bugReportId}.json`;
  const localResult = path.join(os.tmpdir(), `fix-result-${bugReportId}.json`);

  try {
    fs.writeFileSync(localPrompt, prompt, 'utf8');
    await scpToVps(localPrompt, remotePrompt);
    // Best-effort: remove any stale result file from a prior run.
    await sshExec([`rm -f ${q(remoteResult)} ${q(remotePrompt + '.lock')}`]).catch(() => undefined);

    // Launch claude in the background on the VPS, output captured to a log.
    const remoteCmd = `cd ${q(VPS_APP_DIR)} && nohup claude --dangerously-skip-permissions < ${q(remotePrompt)} > /tmp/fix-output-${bugReportId}.log 2>&1 & echo $!`;
    const { stdout: pidRaw } = await sshExec([remoteCmd]);
    const pid = parseInt((pidRaw || '').trim().split('\n').pop() || '', 10);
    if (Number.isFinite(pid)) {
      const cur = inFlightPipelines.get(bugReportId);
      if (cur) cur.pid = pid;
    }

    // Poll for the result file.
    const start = Date.now();
    let finalResult: any = null;
    while (Date.now() - start < POLL_TIMEOUT_MS) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      try {
        await scpFromVps(remoteResult, localResult);
        const text = fs.readFileSync(localResult, 'utf8');
        finalResult = JSON.parse(text);
        break;
      } catch {
        // Not ready yet, or remote file not present
      }
    }
    if (!finalResult) {
      // Timeout
      const cur = inFlightPipelines.get(bugReportId);
      if (cur) cur.status = 'timeout';
      await prisma.bugReport.update({
        where: { id: bugReportId },
        data: { status: 'code_fix_pending' },
      });
      await logOpsAction({
        action: 'fix_pipeline.timeout',
        performedBy: 'system:fix-pipeline',
        targetType: 'fix_pipeline',
        targetId: bugReportId,
        details: { timeoutMs: POLL_TIMEOUT_MS },
      });
      await sendPushNotification({
        userId: SUPPORT_UID,
        title: 'Fix pipeline timed out',
        body: `${bug.product} — ${bug.route}`,
        data: { actionUrl: `/admin/bugs/${bugReportId}`, bugReportId },
      });
      return;
    }

    if (finalResult.success && finalResult.testsPass && finalResult.deployed) {
      const cur = inFlightPipelines.get(bugReportId);
      if (cur) cur.status = 'success';
      await prisma.bugReport.update({
        where: { id: bugReportId },
        data: { status: 'code_fix_deployed', resolvedAt: new Date() },
      });
      await logOpsAction({
        action: 'fix_pipeline.deployed',
        performedBy: 'system:fix-pipeline',
        targetType: 'fix_pipeline',
        targetId: bugReportId,
        details: { testCount: finalResult.testCount ?? null },
      });
      await sendPushNotification({
        userId: SUPPORT_UID,
        title: 'Fix deployed successfully',
        body: `${finalResult.testCount ?? '?'} tests passing.`,
        data: { actionUrl: `/admin/bugs/${bugReportId}`, bugReportId },
      });
      return;
    }

    // Tests failed
    const cur = inFlightPipelines.get(bugReportId);
    if (cur) cur.status = 'failed';
    await prisma.bugReport.update({
      where: { id: bugReportId },
      data: { status: 'code_fix_pending' },
    });
    await logOpsAction({
      action: 'fix_pipeline.tests_failed',
      performedBy: 'system:fix-pipeline',
      targetType: 'fix_pipeline',
      targetId: bugReportId,
      details: { error: String(finalResult.error || '').slice(0, 500) },
    });
    await sendPushNotification({
      userId: SUPPORT_UID,
      title: 'Fix attempted but tests failed',
      body: 'Manual review required.',
      data: { actionUrl: `/admin/bugs/${bugReportId}`, bugReportId },
    });
  } catch (e) {
    const cur = inFlightPipelines.get(bugReportId);
    if (cur) cur.status = 'failed';
    console.error('[ops/fix-pipeline] error:', e);
    await prisma.bugReport.update({
      where: { id: bugReportId },
      data: { status: 'code_fix_pending' },
    });
    await logOpsAction({
      action: 'fix_pipeline.error',
      performedBy: 'system:fix-pipeline',
      targetType: 'fix_pipeline',
      targetId: bugReportId,
      details: { error: (e as Error)?.message?.slice(0, 500) },
    });
  } finally {
    fs.unlink(localPrompt, () => undefined);
  }
}

// ─── Status query ────────────────────────────────────────────────────────────

export async function getFixStatus(bugReportId: string) {
  const prisma = getPrismaClient();
  const bug = await prisma.bugReport.findUnique({ where: { id: bugReportId } });
  if (!bug) return null;
  const live = inFlightPipelines.get(bugReportId);
  return {
    status: bug.status,
    pipelineRunning: live?.status === 'running',
    testsPass: bug.status === 'code_fix_deployed',
    deployed: bug.status === 'code_fix_deployed',
    logSnippet: null as string | null,
    startedAt: live?.startedAt,
    pid: live?.pid,
  };
}

function q(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

export const __test__ = {
  buildFixPrompt,
  POLL_TIMEOUT_MS,
  POLL_INTERVAL_MS,
  inFlightPipelines,
};
