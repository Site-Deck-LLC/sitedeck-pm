/**
 * Tests for the BYOK (Bring-Your-Own-Key) service.
 * - AES-256-GCM round-trip via wrapKey/unwrapKey
 * - getEffectiveAnthropicKey returns custom key when configured
 * - getEffectiveAnthropicKey returns env key when no custom key
 * - setOrgAnthropicKey encrypts at rest (no plaintext in storage)
 * - deleteOrgAnthropicKey is idempotent
 * - hasOrgAnthropicKey returns boolean only (never the key)
 * - invalid key format: bypasses the service layer (validated at route)
 */

import { wrapKey, unwrapKey } from '../lib/byok-encryption';
import {
  getEffectiveAnthropicKey,
  setOrgAnthropicKey,
  deleteOrgAnthropicKey,
  hasOrgAnthropicKey,
  __resetByokCacheForTests,
} from './byok.service';

const originalEnv = { ...process.env };

// Generate a 32-byte test key.
const TEST_KEY = 'a'.repeat(64);

const mockProjectFindUnique = jest.fn();
const mockOrgApiKeyFindUnique = jest.fn();
const mockOrgApiKeyUpsert = jest.fn();
const mockOrgApiKeyDelete = jest.fn();

jest.mock('../lib/prisma', () => ({
  getPrismaClient: () => ({
    project: { findUnique: mockProjectFindUnique },
    orgApiKey: {
      findUnique: mockOrgApiKeyFindUnique,
      upsert: mockOrgApiKeyUpsert,
      delete: mockOrgApiKeyDelete,
    },
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  __resetByokCacheForTests();
  process.env.BYOK_ENCRYPTION_KEY = TEST_KEY;
  // Default: no platform key.
  delete process.env.ANTHROPIC_API_KEY;
  // Default: project lookup returns org-org1.
  mockProjectFindUnique.mockResolvedValue({ orgId: 'org-1' });
  // Default: no custom key.
  mockOrgApiKeyFindUnique.mockResolvedValue(null);
  // Upsert and delete succeed by default.
  mockOrgApiKeyUpsert.mockImplementation(async ({ create, update }: any) => ({
    id: 'row-1',
    orgId: create?.orgId || update?.orgId,
    provider: 'anthropic',
    keyEncrypted: create?.keyEncrypted || update?.keyEncrypted,
    createdBy: create?.createdBy,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
  mockOrgApiKeyDelete.mockResolvedValue({ id: 'row-1' });
});

afterEach(() => {
  process.env = { ...originalEnv };
});

describe('wrapKey/unwrapKey', () => {
  it('round-trips a value', () => {
    const wrapped = wrapKey('sk-ant-test-12345');
    expect(wrapped).toMatch(/^v1:[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/);
    expect(unwrapKey(wrapped)).toBe('sk-ant-test-12345');
  });

  it('produces a different ciphertext for the same input each time (random IV)', () => {
    const a = wrapKey('sk-ant-test');
    const b = wrapKey('sk-ant-test');
    expect(a).not.toBe(b);
    expect(unwrapKey(a)).toBe('sk-ant-test');
    expect(unwrapKey(b)).toBe('sk-ant-test');
  });

  it('rejects garbage ciphertext (GCM auth failure)', () => {
    const wrapped = wrapKey('secret');
    // Tamper with the ciphertext
    const tampered = wrapped.replace(/[0-9a-f]$/, '0');
    expect(() => unwrapKey(tampered)).toThrow();
  });

  it('throws when BYOK_ENCRYPTION_KEY is missing', () => {
    delete process.env.BYOK_ENCRYPTION_KEY;
    expect(() => wrapKey('x')).toThrow(/BYOK_ENCRYPTION_KEY/);
  });

  it('throws when BYOK_ENCRYPTION_KEY is the wrong length', () => {
    process.env.BYOK_ENCRYPTION_KEY = 'aabbcc'; // not 32 bytes
    expect(() => wrapKey('x')).toThrow(/32 bytes/);
  });

  it('rejects legacy plaintext rows (no v1: prefix)', () => {
    expect(() => unwrapKey('sk-ant-plaintext')).toThrow(/legacy plaintext/);
  });
});

describe('getEffectiveAnthropicKey', () => {
  it('returns the env key when no custom key is configured', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-platform-key';
    const result = await getEffectiveAnthropicKey('proj-1');
    expect(result).toBe('sk-platform-key');
  });

  it('returns the custom key when one is set for the org', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-platform-key';
    mockOrgApiKeyFindUnique.mockResolvedValue({
      id: 'row-1',
      orgId: 'org-1',
      provider: 'anthropic',
      keyEncrypted: wrapKey('sk-custom-enterprise-key'),
    });
    const result = await getEffectiveAnthropicKey('proj-1');
    expect(result).toBe('sk-custom-enterprise-key');
  });

  it('returns null when no key is available anywhere', async () => {
    const result = await getEffectiveAnthropicKey('proj-1');
    expect(result).toBeNull();
  });

  it('returns the env key when the project does not exist', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-platform';
    mockProjectFindUnique.mockResolvedValue(null);
    const result = await getEffectiveAnthropicKey('proj-missing');
    expect(result).toBe('sk-platform');
  });

  it('caches the decrypted key across calls (avoids repeat decrypts)', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-platform';
    mockOrgApiKeyFindUnique.mockResolvedValue({
      id: 'row-1',
      orgId: 'org-1',
      provider: 'anthropic',
      keyEncrypted: wrapKey('sk-custom-cached'),
    });
    await getEffectiveAnthropicKey('proj-1');
    await getEffectiveAnthropicKey('proj-1');
    // The findUnique is called once for the org, then cached.
    expect(mockOrgApiKeyFindUnique).toHaveBeenCalledTimes(1);
  });
});

describe('setOrgAnthropicKey', () => {
  it('encrypts the key before persisting (no plaintext in the row)', async () => {
    await setOrgAnthropicKey({
      orgId: 'org-1',
      anthropicApiKey: 'sk-ant-secret',
      userId: 'u-1',
    });
    expect(mockOrgApiKeyUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          orgId: 'org-1',
          keyEncrypted: expect.stringMatching(/^v1:/),
        }),
      })
    );
    // The plaintext is NOT in the persisted value
    const call = mockOrgApiKeyUpsert.mock.calls[0][0];
    expect(call.create.keyEncrypted).not.toContain('sk-ant-secret');
  });

  it('round-trips: read after write returns the original key', async () => {
    // Simulate the DB: the row that was written is now findable.
    let storedRow: any = null;
    mockOrgApiKeyUpsert.mockImplementation(async ({ create, update }: any) => {
      const data = create || update;
      storedRow = { id: 'row-1', orgId: data.orgId, provider: 'anthropic', keyEncrypted: data.keyEncrypted };
      return storedRow;
    });
    mockOrgApiKeyFindUnique.mockImplementation(async () => storedRow);
    await setOrgAnthropicKey({
      orgId: 'org-1',
      anthropicApiKey: 'sk-ant-roundtrip',
      userId: 'u-1',
    });
    __resetByokCacheForTests(); // force a fresh read
    const effective = await getEffectiveAnthropicKey('proj-1');
    expect(effective).toBe('sk-ant-roundtrip');
  });
});

describe('deleteOrgAnthropicKey', () => {
  it('is idempotent (P2025 is swallowed)', async () => {
    const err: any = new Error('not found');
    err.code = 'P2025';
    mockOrgApiKeyDelete.mockRejectedValue(err);
    await expect(deleteOrgAnthropicKey('org-1')).resolves.toBeUndefined();
  });

  it('rethrows non-P2025 errors', async () => {
    mockOrgApiKeyDelete.mockRejectedValue(new Error('db down'));
    await expect(deleteOrgAnthropicKey('org-1')).rejects.toThrow(/db down/);
  });
});

describe('hasOrgAnthropicKey', () => {
  it('returns true when the row exists', async () => {
    mockOrgApiKeyFindUnique.mockResolvedValue({ id: 'row-1' });
    expect(await hasOrgAnthropicKey('org-1')).toBe(true);
  });

  it('returns false when the row is missing', async () => {
    mockOrgApiKeyFindUnique.mockResolvedValue(null);
    expect(await hasOrgAnthropicKey('org-1')).toBe(false);
  });
});
