import request from 'supertest';
import { createApp } from '../index';

describe('GET /api/v1/health', () => {
  it('returns ok status', async () => {
    const app = createApp();
    const res = await request(app).get('/api/v1/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('sitedeck-pm');
  });
});
