/**
 * Prompt Injection Sanitization
 * ============================================================================
 * Strips user-controlled content before it is included in a model prompt.
 * This is the LAST line of defense — system-prompt architecture and input
 * validation should also be enforced at the route layer.
 *
 * Threats mitigated:
 *   1. Direct prompt injection — "Ignore previous instructions and…"
 *   2. Indirect injection — user-provided text that overrides role: tags
 *   3. Model-channel smuggling — control sequences that flip modes
 *   4. Excessive length — one user's giant attachment blowing out the
 *      context window and starving out other users
 *
 * Strategy:
 *   - Replace role markers (system:, user:, assistant:) with safe equivalents
 *   - Strip "ignore instructions" patterns
 *   - Cap length per field (default 500 chars; configurable per use)
 *   - Collapse control characters and newlines into a single line
 *   - Strip code blocks and backticks (defense in depth)
 *   - Always return a string, even when input is null/undefined/object
 *
 * All sanitization is conservative: it errs on the side of stripping
 * legitimate content rather than risking prompt leakage. The cost of a
 * sanitized-but-blurry brief is far lower than the cost of a leaked key
 * or a prompt-injected agent.
 * ============================================================================
 */

const ROLE_MARKERS = [
  /\bsystem\s*:/gi,
  /\buser\s*:/gi,
  /\bassistant\s*:/gi,
  /<\|[^|]*\|>/g, // OpenAI-style channel markers — match <| ... |> per token
  // After stripping the channel markers, a bare 'system'/'user'/'assistant' word
  // remains (e.g. '<|im_start|>system<|im_end|>' → 'system'). Strip those too.
  /(?:^|\s)(system|user|assistant)(?=\s|$)/gi,
  /```/g, // code fences
  /`/g, // backticks
];

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
  /disregard\s+(all\s+)?(previous|prior|above)\s+instructions?/gi,
  /forget\s+(everything|all)\s+(you|that)/gi,
  /you\s+are\s+now\s+/gi,
  /new\s+instructions?\s*:/gi,
  /system\s*prompt\s*:/gi,
  /\bjailbreak/gi,
  /\bDAN\s*mode/gi,
];

/**
 * Sanitize a single string field for inclusion in a prompt. Returns '' when
 * input is null/undefined. Coerces non-strings to String() then sanitizes.
 *
 * @param input - The raw value (user-controlled or derived from data the
 *                user can edit).
 * @param opts.maxLen - Max length of the sanitized output (default 500).
 *                      Longer inputs are truncated with an ellipsis marker.
 * @param opts.allowNewlines - If false (default), collapse all whitespace to
 *                             a single space. Set true for freeform text
 *                             that should keep paragraph breaks.
 */
export function sanitizeForPrompt(
  input: unknown,
  opts: { maxLen?: number; allowNewlines?: boolean } = {}
): string {
  const maxLen = opts.maxLen ?? 500;
  const allowNewlines = opts.allowNewlines ?? false;

  if (input === null || input === undefined) return '';
  let s = typeof input === 'string' ? input : String(input);

  // Strip control characters (keep printable + tab/newline if allowed)
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '');

  // Strip role markers and code fences
  for (const pat of ROLE_MARKERS) {
    s = s.replace(pat, '');
  }

  // Strip injection phrases (replace with a benign marker so we don't
  // completely silently alter the meaning)
  for (const pat of INJECTION_PATTERNS) {
    s = s.replace(pat, '[redacted-instruction]');
  }

  // Normalize whitespace
  if (allowNewlines) {
    // Collapse runs of 3+ newlines into 2; strip leading/trailing whitespace
    s = s.replace(/\n{3,}/g, '\n\n').trim();
  } else {
    // Collapse all whitespace (including newlines) to a single space
    s = s.replace(/\s+/g, ' ').trim();
  }

  // Truncate
  if (s.length > maxLen) {
    s = s.slice(0, maxLen) + '…';
  }

  return s;
}

/**
 * Sanitize a record of fields. Each value is sanitized individually.
 * Useful for sanitizing a whole model object (e.g. an RFI or CO).
 */
export function sanitizeRecord(
  record: Record<string, unknown>,
  opts: { maxLen?: number; allowNewlines?: boolean } = {}
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(record)) {
    out[key] = sanitizeForPrompt(val, opts);
  }
  return out;
}
