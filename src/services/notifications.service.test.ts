/**
 * Tests for the notifications service. The service is the only
 * "loud" reader of the prisma client — the routes are thin. So
 * the bulk of the contract is tested here.
 *
 * What's verified:
 *   - createNotification: writes a row, returns the API shape
 *   - createNotificationSafe: swallows errors, never throws
 *   - listNotifications: userId + read filter, cursor pagination
 *   - countUnreadNotifications: counts read=false; returns 0 on error
 *   - markNotificationRead: flips read+readAt; throws not_found
 *     when row missing or owned by someone else
 *   - markAllNotificationsRead: updateMany semantics
 */

import {
  createNotification,
  createNotificationSafe,
  listNotifications,
  countUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  NotificationNotFoundError,
} from './notifications.service';

const mockNotificationCreate = jest.fn();
const mockNotificationFindMany = jest.fn();
const mockNotificationCount = jest.fn();
const mockNotificationUpdate = jest.fn();
const mockNotificationUpdateMany = jest.fn();

jest.mock('../lib/prisma', () => ({
  getPrismaClient: () => ({
    notification: {
      create: mockNotificationCreate,
      findMany: mockNotificationFindMany,
      count: mockNotificationCount,
      update: mockNotificationUpdate,
      updateMany: mockNotificationUpdateMany,
    },
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('createNotification', () => {
  it('writes a row and returns the API shape', async () => {
    const created = {
      id: 'n-1',
      userId: 'u-1',
      kind: 'rfi_assigned',
      title: 'RFI 12 needs your response',
      body: 'Subject line',
      payload: { projectId: 'p-1', rfiNumber: 'RFI-12' },
      read: false,
      readAt: null,
      createdAt: new Date('2026-06-13T12:00:00Z'),
    };
    mockNotificationCreate.mockResolvedValue(created);

    const result = await createNotification({
      userId: 'u-1',
      kind: 'rfi_assigned',
      title: 'RFI 12 needs your response',
      body: 'Subject line',
      payload: { projectId: 'p-1', rfiNumber: 'RFI-12' },
    });

    expect(result.id).toBe('n-1');
    expect(result.read).toBe(false);
    expect(result.readAt).toBeNull();
    expect(result.createdAt).toBe('2026-06-13T12:00:00.000Z');
    expect(result.payload).toEqual({ projectId: 'p-1', rfiNumber: 'RFI-12' });
    // Body is preserved.
    expect(result.body).toBe('Subject line');
  });

  it('passes null for missing body and payload', async () => {
    mockNotificationCreate.mockResolvedValue({
      id: 'n-2',
      userId: 'u-2',
      kind: 'system',
      title: 'Welcome',
      body: null,
      payload: null,
      read: false,
      readAt: null,
      createdAt: new Date(),
    });
    const result = await createNotification({
      userId: 'u-2',
      kind: 'system',
      title: 'Welcome',
    });
    expect(result.body).toBeNull();
    expect(result.payload).toBeNull();
  });
});

describe('createNotificationSafe', () => {
  it('swallows errors and never throws', async () => {
    mockNotificationCreate.mockRejectedValue(new Error('table missing'));
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(
      createNotificationSafe({ userId: 'u-1', kind: 'system', title: 'x' })
    ).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('returns void on success', async () => {
    mockNotificationCreate.mockResolvedValue({
      id: 'n-3', userId: 'u-3', kind: 'system', title: 't',
      body: null, payload: null, read: false, readAt: null, createdAt: new Date(),
    });
    const result = await createNotificationSafe({ userId: 'u-3', kind: 'system', title: 't' });
    expect(result).toBeUndefined();
  });
});

describe('listNotifications', () => {
  it('queries the user with newest first', async () => {
    mockNotificationFindMany.mockResolvedValue([]);
    await listNotifications({ userId: 'u-1' });
    expect(mockNotificationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u-1' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
    );
  });

  it('applies unread filter when requested', async () => {
    mockNotificationFindMany.mockResolvedValue([]);
    await listNotifications({ userId: 'u-1', unreadOnly: true });
    expect(mockNotificationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'u-1', read: false } })
    );
  });

  it('uses cursor pagination when given', async () => {
    mockNotificationFindMany.mockResolvedValue([]);
    await listNotifications({ userId: 'u-1', cursor: 'last-id' });
    expect(mockNotificationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: 'last-id' }, skip: 1 })
    );
  });

  it('respects the limit cap', async () => {
    mockNotificationFindMany.mockResolvedValue([]);
    await listNotifications({ userId: 'u-1', limit: 5 });
    expect(mockNotificationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 })
    );
  });
});

describe('countUnreadNotifications', () => {
  it('counts read=false rows for the user', async () => {
    mockNotificationCount.mockResolvedValue(7);
    const result = await countUnreadNotifications('u-1');
    expect(result).toBe(7);
    expect(mockNotificationCount).toHaveBeenCalledWith({
      where: { userId: 'u-1', read: false },
    });
  });

  it('returns 0 when the query throws (standalone degradation)', async () => {
    mockNotificationCount.mockRejectedValue(new Error('db down'));
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const result = await countUnreadNotifications('u-1');
    expect(result).toBe(0);
    consoleSpy.mockRestore();
  });
});

describe('markNotificationRead', () => {
  it('updates read and readAt', async () => {
    mockNotificationUpdate.mockResolvedValue({
      id: 'n-1', userId: 'u-1', kind: 'system', title: 't',
      body: null, payload: null, read: true, readAt: new Date('2026-06-13T13:00:00Z'),
      createdAt: new Date('2026-06-13T12:00:00Z'),
    });
    const result = await markNotificationRead('n-1', 'u-1');
    expect(result.read).toBe(true);
    expect(result.readAt).toBe('2026-06-13T13:00:00.000Z');
  });

  it('throws NotificationNotFoundError when the row is owned by someone else', async () => {
    mockNotificationUpdate.mockResolvedValue({
      id: 'n-1', userId: 'someone-else', kind: 'system', title: 't',
      body: null, payload: null, read: true, readAt: new Date(),
      createdAt: new Date(),
    });
    await expect(markNotificationRead('n-1', 'u-1')).rejects.toBeInstanceOf(NotificationNotFoundError);
  });

  it('translates Prisma P2025 to NotificationNotFoundError', async () => {
    const err: any = new Error('not found');
    err.code = 'P2025';
    mockNotificationUpdate.mockRejectedValue(err);
    await expect(markNotificationRead('n-1', 'u-1')).rejects.toBeInstanceOf(NotificationNotFoundError);
  });

  it('rethrows non-P2025 errors', async () => {
    mockNotificationUpdate.mockRejectedValue(new Error('db down'));
    await expect(markNotificationRead('n-1', 'u-1')).rejects.toThrow(/db down/);
  });
});

describe('markAllNotificationsRead', () => {
  it('updates all unread rows for the user and returns the count', async () => {
    mockNotificationUpdateMany.mockResolvedValue({ count: 4 });
    const result = await markAllNotificationsRead('u-1');
    expect(result).toEqual({ updated: 4 });
    expect(mockNotificationUpdateMany).toHaveBeenCalledWith({
      where: { userId: 'u-1', read: false },
      data: { read: true, readAt: expect.any(Date) },
    });
  });

  it('returns updated=0 when no unread rows', async () => {
    mockNotificationUpdateMany.mockResolvedValue({ count: 0 });
    const result = await markAllNotificationsRead('u-1');
    expect(result.updated).toBe(0);
  });
});
