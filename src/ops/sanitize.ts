/**
 * ops/sanitize.ts — Sprint 10
 * ============================================================================
 * Tighter sanitization than the default sanitizeForPrompt in
 * src/lib/sanitize.ts. The triage agent operates on user-reported content
 * that may contain PII, credentials, API tokens, or other secrets. We
 * apply additional redaction passes before the content reaches the model.
 *
 * Threat model:
 *   - User pastes an auth token or password into the "What were you
 *     trying to do" field
 *   - Console error contains an Authorization header
 *   - API response body contains a session cookie
 *
 * Strategy:
 *   - First, run the standard sanitizeForPrompt() (role markers, code
 *     fences, control chars, length cap)
 *   - Then, run pattern-based redaction: Bearer/JWT-like strings, AWS
 *     keys, generic email addresses (replaced with [redacted-email]),
 *     and credit-card-shaped digit runs
 *
 * Always returns a string. Always safe to feed to a model.
 * ============================================================================
 */

import { sanitizeForPrompt as baseSanitize } from '../lib/sanitize';

const BEARER_RE = /Bearer\s+[A-Za-z0-9\-._~+/]{8,}=*/g;
const JWT_RE = /eyJ[A-Za-z0-9\-_]{10,}\.[A-Za-z0-9\-_]{10,}\.[A-Za-z0-9\-_]{10,}/g;
const AWS_KEY_RE = /AKIA[0-9A-Z]{16}/g;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const CC_RE = /\b(?:\d[ -]?){13,19}\b/g;
const COOKIE_RE = /(?:session|auth|token|sid|jsid)=[A-Za-z0-9\-_.~+/=]+/gi;

const REDACTION_PATTERNS: Array<{ re: RegExp; replacement: string }> = [
  { re: BEARER_RE, replacement: 'Bearer [redacted]' },
  { re: JWT_RE, replacement: '[redacted-jwt]' },
  { re: AWS_KEY_RE, replacement: '[redacted-aws-key]' },
  { re: COOKIE_RE, replacement: '[redacted-cookie]' },
  { re: EMAIL_RE, replacement: '[redacted-email]' },
  { re: CC_RE, replacement: '[redacted-cc]' },
];

export interface SanitizeTriageInputOpts {
  maxLen?: number;
  allowNewlines?: boolean;
}

export function sanitizeTriageInput(
  input: unknown,
  opts: SanitizeTriageInputOpts = {}
): string {
  const maxLen = opts.maxLen ?? 1500;
  // First pass — prompt-injection sanitization from the base helper.
  let s = baseSanitize(input, { maxLen, allowNewlines: opts.allowNewlines });
  // Second pass — secret / PII redaction.
  for (const { re, replacement } of REDACTION_PATTERNS) {
    s = s.replace(re, replacement);
  }
  return s;
}

/**
 * Sanitize a whole object for triage. Recursively walks string values,
 * skipping already-redacted values to avoid double-mangling. Non-string
 * values are stringified and sanitized (bounded length).
 */
export function sanitizeTriageObject<T extends Record<string, unknown>>(
  obj: T,
  opts: SanitizeTriageInputOpts = {}
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) {
      out[k] = '';
    } else if (typeof v === 'string') {
      out[k] = sanitizeTriageInput(v, opts);
    } else {
      // Stringify (e.g. JSON bodies) and sanitize.
      out[k] = sanitizeTriageInput(JSON.stringify(v), opts);
    }
  }
  return out;
}
