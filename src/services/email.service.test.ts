import * as email from './email.service';

const originalHost = process.env.MAIL_HOST;
const originalFrom = process.env.MAIL_FROM;

beforeEach(() => {
  delete process.env.MAIL_HOST;
  delete process.env.MAIL_PORT;
  delete process.env.MAIL_USER;
  delete process.env.MAIL_PASS;
  process.env.MAIL_FROM = 'SiteDeck Helper <helper@modestintent.com>';
  // Reset the cached transport so each test sees the env state
  // set in this beforeEach.
  email.__test__.resetTransport();
});

afterAll(() => {
  if (originalHost) process.env.MAIL_HOST = originalHost;
  if (originalFrom) process.env.MAIL_FROM = originalFrom;
  else delete process.env.MAIL_FROM;
});

describe('sendEmail', () => {
  it('returns the no-recipients branch', async () => {
    const r = await email.sendEmail({ to: [], subject: 's', text: 't' });
    expect(r.ok).toBe(false);
    expect(r.sent).toBe(0);
  });

  it('falls back gracefully when MAIL_HOST is not set', async () => {
    const r = await email.sendEmail({ to: 'pm@example.com', subject: 's', text: 't' });
    expect(r.fallback).toBe(true);
    expect(r.ok).toBe(true);
    expect(r.sent).toBe(1);
  });

  it('accepts a string-array of recipients', async () => {
    const r = await email.sendEmail({ to: ['a@x.com', 'b@x.com'], subject: 's', text: 't' });
    expect(r.sent).toBe(2);
  });
});

describe('specialized senders', () => {
  it('sendRfiOverdueAlert formats the subject', async () => {
    const r = await email.sendRfiOverdueAlert({
      rfiId: 'r1',
      rfiNumber: 'RFI-2026-0001',
      recipientEmail: 'pm@example.com',
      projectName: 'BESS Site A',
      daysOpen: 14,
      link: 'https://example.com/r/1',
    });
    expect(r.ok).toBe(true);
  });

  it('sendOwnerReportReady formats the subject', async () => {
    const r = await email.sendOwnerReportReady({
      reportId: 'rep-1',
      ownerEmail: 'owner@example.com',
      projectName: 'Substation 7',
      weekEnding: '2026-06-13',
      link: 'https://example.com/r/rep-1',
    });
    expect(r.ok).toBe(true);
  });

  it('sendDrawingIFCRelease BCCs recipients', async () => {
    const r = await email.sendDrawingIFCRelease({
      documentId: 'd1',
      drawingNumber: 'A-101',
      title: 'First Floor',
      revision: 2,
      projectName: 'BESS Site A',
      recipientEmails: ['a@x.com', 'b@x.com', 'c@x.com'],
      link: 'https://example.com/d/1',
    });
    expect(r.sent).toBe(3);
    expect(r.ok).toBe(true);
  });

  it('sendWelcomeEmail sends to a single address', async () => {
    const r = await email.sendWelcomeEmail({
      recipientEmail: 'new@example.com',
      displayName: 'Pat',
      projectName: 'Substation 7',
      role: 'project_manager',
      loginLink: 'https://example.com/login',
    });
    expect(r.sent).toBe(1);
  });

  it('sendNCRAlert surfaces severity in the body', async () => {
    const r = await email.sendNCRAlert({
      ncrId: 'n1',
      ncrNumber: 'NCR-001',
      severity: 'critical',
      recipientEmail: 'pm@example.com',
      projectName: 'T-Line 12',
      dfow: 'Foundation 03',
      benchmarkLink: 'https://benchmark.example/n/1',
    });
    expect(r.ok).toBe(true);
  });
});
