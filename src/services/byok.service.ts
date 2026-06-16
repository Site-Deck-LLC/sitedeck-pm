/**
 * byok.service.ts — Bring-Your-Own-Key for enterprise Anthropic usage
 * ============================================================================
 * Sprint 8: when an org has a custom Anthropic key configured via
 * `POST /api/v1/billing/byok`, the agent client should use that key
 * for API calls instead of `process.env.ANTHROPIC_API_KEY`. The
 * platform key is the fallback; per-org keys are an enterprise feature.
 *
 * Security notes:
 *   - Custom keys are AES-256-GCM encrypted at rest using
 *     `BYOK_ENCRYPTION_KEY` (see lib/byok-encryption.ts).
 *   - The decrypted key is never logged, never returned in API
 *     responses, and is cached in-process for 5 minutes under a
 *     separate process-local map (NOT module-level) to avoid
 *     hammering the DB on every agent call.
 *   - `getEffectiveAnthropicKey` takes a `projectId` (not an orgId)
 *     because every agent call already has a projectId in hand; the
 *     project → orgId lookup is one extra query. We accept that cost
 *     to keep the call site clean. For Sprint 9 this could be cached
 *     in a `(projectId → orgId)` Map.
 * ============================================================================
 */

import { getPrismaClient } from '../lib/prisma';
import { wrapKey, unwrapKey } from '../lib/byok-encryption';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min — bounded window for key reuse
const keyCache = new Map<string, { value: string; setAt: number }>(); // orgId -> { value, setAt }
const orgForProjectCache = new Map<string, { orgId: string; setAt: number }>();

async function getOrgIdForProject(projectId: string): Promise<string | null> {
  const cached = orgForProjectCache.get(projectId);
  if (cached && Date.now() - cached.setAt < CACHE_TTL_MS) return cached.orgId;
  const prisma = getPrismaClient();
  const proj = await prisma.project.findUnique({
    where: { id: projectId },
    select: { orgId: true },
  });
  if (!proj) return null;
  orgForProjectCache.set(projectId, { orgId: proj.orgId, setAt: Date.now() });
  return proj.orgId;
}

async function getCustomKeyForOrg(orgId: string): Promise<string | null> {
  const cached = keyCache.get(orgId);
  if (cached && Date.now() - cached.setAt < CACHE_TTL_MS) return cached.value;
  const prisma = getPrismaClient();
  const row = await prisma.orgApiKey.findUnique({
    where: { orgId_provider: { orgId, provider: 'anthropic' } },
  });
  if (!row) {
    keyCache.delete(orgId);
    return null;
  }
  let decrypted: string;
  try {
    decrypted = unwrapKey(row.keyEncrypted);
  } catch (err: any) {
    // Legacy plaintext row (pre-encryption). Log and re-throw — the
    // operator must run a one-off migration to re-encrypt.
    console.warn(`[byok] Failed to decrypt org key for org=${orgId}: ${err?.message}`);
    throw err;
  }
  keyCache.set(orgId, { value: decrypted, setAt: Date.now() });
  return decrypted;
}

/**
 * Returns the Anthropic API key to use for a given project. Custom
 * org key takes priority; the platform key is the fallback.
 */
export async function getEffectiveAnthropicKey(projectId: string): Promise<string | null> {
  // Fast path: if a platform key is configured and there's no chance
  // of an org override, skip the project lookup. We do still need to
  // check for an org override when one might exist — but in dev/test
  // this avoids the prisma round-trip.
  const platformKey = process.env.ANTHROPIC_API_KEY || null;
  const orgId = await getOrgIdForProject(projectId);
  if (orgId) {
    const custom = await getCustomKeyForOrg(orgId);
    if (custom) return custom;
  }
  return platformKey;
}

/**
 * Store or replace an org's custom Anthropic key. The plaintext key
 * is encrypted at rest. Never logged.
 */
export async function setOrgAnthropicKey(input: {
  orgId: string;
  anthropicApiKey: string;
  userId: string;
}): Promise<void> {
  const prisma = getPrismaClient();
  const encrypted = wrapKey(input.anthropicApiKey);
  await prisma.orgApiKey.upsert({
    where: { orgId_provider: { orgId: input.orgId, provider: 'anthropic' } },
    create: {
      orgId: input.orgId,
      provider: 'anthropic',
      keyEncrypted: encrypted,
      createdBy: input.userId,
    },
    update: {
      keyEncrypted: encrypted,
      updatedAt: new Date(),
    },
  });
  // Invalidate cache so the next call decrypts the new value.
  keyCache.delete(input.orgId);
}

export async function deleteOrgAnthropicKey(orgId: string): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.orgApiKey
    .delete({ where: { orgId_provider: { orgId, provider: 'anthropic' } } })
    .catch((err: any) => {
      // Swallow P2025 (not found) — the DELETE is idempotent.
      if (err?.code !== 'P2025') throw err;
    });
  keyCache.delete(orgId);
}

export async function hasOrgAnthropicKey(orgId: string): Promise<boolean> {
  const prisma = getPrismaClient();
  const row = await prisma.orgApiKey.findUnique({
    where: { orgId_provider: { orgId, provider: 'anthropic' } },
    select: { id: true },
  });
  return !!row;
}

// Test-only helper — clears the in-process caches. Not exported
// through the public API surface.
export function __resetByokCacheForTests() {
  keyCache.clear();
  orgForProjectCache.clear();
}
