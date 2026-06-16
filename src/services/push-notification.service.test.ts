import * as push from './push-notification.service';

const mockFcmTokenFindMany = jest.fn();
const mockFcmTokenFindUnique = jest.fn();
const mockFcmTokenCreate = jest.fn();
const mockFcmTokenUpdate = jest.fn();
const mockFcmTokenDelete = jest.fn();

jest.mock('../lib/prisma', () => ({
  getPrismaClient: () => ({
    fcmToken: {
      findMany: mockFcmTokenFindMany,
      findUnique: mockFcmTokenFindUnique,
      create: mockFcmTokenCreate,
      update: mockFcmTokenUpdate,
      delete: mockFcmTokenDelete,
    },
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('saveFcmToken', () => {
  it('creates a new token when no row exists for the (user, platform)', async () => {
    mockFcmTokenFindUnique.mockResolvedValueOnce(null);
    mockFcmTokenCreate.mockResolvedValueOnce({ id: 't-new' });
    const result = await push.saveFcmToken({ userId: 'u1', token: 'tok', platform: 'web' });
    expect(result.id).toBe('t-new');
    expect(mockFcmTokenCreate).toHaveBeenCalledWith({
      data: { userId: 'u1', token: 'tok', platform: 'web' },
    });
  });

  it('updates an existing token for the same (user, platform)', async () => {
    mockFcmTokenFindUnique.mockResolvedValueOnce({ id: 't1' });
    mockFcmTokenUpdate.mockResolvedValueOnce({ id: 't1' });
    const result = await push.saveFcmToken({ userId: 'u1', token: 'tok2', platform: 'ios' });
    expect(result.id).toBe('t1');
    expect(mockFcmTokenUpdate).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: expect.objectContaining({ token: 'tok2' }),
    });
  });
});

describe('removeFcmToken', () => {
  it('returns removed=false when no row exists', async () => {
    mockFcmTokenFindUnique.mockResolvedValueOnce(null);
    const r = await push.removeFcmToken('u1', 'web');
    expect(r.removed).toBe(false);
  });

  it('deletes the row when it exists', async () => {
    mockFcmTokenFindUnique.mockResolvedValueOnce({ id: 't1' });
    const r = await push.removeFcmToken('u1', 'web');
    expect(r.removed).toBe(true);
    expect(mockFcmTokenDelete).toHaveBeenCalledWith({ where: { id: 't1' } });
  });
});

describe('sendPushNotification', () => {
  it('returns noTokens=true when the user has no tokens', async () => {
    mockFcmTokenFindMany.mockResolvedValueOnce([]);
    const r = await push.sendPushNotification({
      userId: 'u1',
      title: 't',
      body: 'b',
    });
    expect(r.noTokens).toBe(true);
    expect(r.attempted).toBe(0);
  });

  it('does not throw when firebase-admin is not installed (best-effort)', async () => {
    mockFcmTokenFindMany.mockResolvedValueOnce([
      { id: 't1', token: 'tok', platform: 'web' },
    ]);
    // firebase-admin is not installed in the test env, so the
    // service falls through and reports 0 sent without throwing.
    const r = await push.sendPushNotification({
      userId: 'u1',
      title: 't',
      body: 'b',
    });
    expect(r.noTokens).toBe(false);
    expect(r.attempted).toBe(1);
    // No throw is the contract.
  });
});

describe('sendToProjectMembers', () => {
  it('returns sent=0 when no tokens are registered', async () => {
    mockFcmTokenFindMany.mockResolvedValueOnce([]);
    const r = await push.sendToProjectMembers({ projectId: 'p1', title: 't' });
    expect(r.sent).toBe(0);
    expect(r.failed).toBe(0);
  });
});
