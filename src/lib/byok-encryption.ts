/**
 * byok-encryption.ts — AES-256-GCM at-rest encryption for BYOK keys
 * ============================================================================
 * The org_api_keys.keyEncrypted column stores the user's Anthropic key
 * wrapped with AES-256-GCM. The wrapping key comes from
 * `BYOK_ENCRYPTION_KEY` (32 bytes, hex-encoded). If the env var is
 * missing, `wrapKey()` throws — there is no plaintext fallback because
 * the spec calls for "encrypted at rest" explicitly, and the existing
 * plaintext storage in the dev DB should not be allowed to continue.
 *
 * The on-disk layout is: v1:<iv-hex>:<tag-hex>:<ciphertext-hex>. The
 * "v1:" prefix is for future rotation — a v2 wrapper can be added
 * without breaking old rows.
 *
 * The key is never logged. Errors intentionally do not include the
 * ciphertext, only the operation that failed.
 * ============================================================================
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGO = 'aes-256-gcm';
const PREFIX = 'v1:';

function getWrapKey(): Buffer {
  const hex = process.env.BYOK_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error('BYOK_ENCRYPTION_KEY is not set; refusing to encrypt without it');
  }
  const buf = Buffer.from(hex, 'hex');
  if (buf.length !== 32) {
    throw new Error(
      `BYOK_ENCRYPTION_KEY must be 32 bytes (64 hex chars); got ${buf.length}`
    );
  }
  return buf;
}

export function wrapKey(plaintext: string): string {
  if (!plaintext) throw new Error('wrapKey: plaintext is empty');
  const key = getWrapKey();
  const iv = randomBytes(12); // GCM standard IV length
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + iv.toString('hex') + ':' + tag.toString('hex') + ':' + enc.toString('hex');
}

export function unwrapKey(stored: string): string {
  if (!stored) throw new Error('unwrapKey: stored value is empty');
  if (!stored.startsWith(PREFIX)) {
    // Legacy plaintext rows from before encryption was added. Refuse
    // to silently fall through — re-encrypt via a one-off migration.
    throw new Error('unwrapKey: stored value is not in v1: format (legacy plaintext)');
  }
  const parts = stored.slice(PREFIX.length).split(':');
  if (parts.length !== 3) {
    throw new Error('unwrapKey: stored value is malformed');
  }
  const [ivHex, tagHex, ctHex] = parts;
  const key = getWrapKey();
  const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(ctHex, 'hex')),
    decipher.final(),
  ]);
  return dec.toString('utf8');
}
