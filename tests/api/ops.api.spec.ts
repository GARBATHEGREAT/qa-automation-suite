import { expect, test } from '@playwright/test';

test.describe('API: health, monitoring and security headers', () => {
  test('/health and /ready report the service is up', async ({ request }) => {
    const health = await request.get('/health');
    expect(health.status()).toBe(200);
    expect((await health.json()).status).toBe('ok');
    const ready = await request.get('/ready');
    expect(ready.status()).toBe(200);
    expect((await ready.json()).status).toBe('ready');
  });

  test('every response carries a request id for tracing', async ({ request }) => {
    const res = await request.get('/api/does-not-exist');
    expect(res.headers()['x-request-id']).toBeTruthy();
    const custom = await request.get('/health', { headers: { 'x-request-id': 'qa-trace-123' } });
    expect(custom.headers()['x-request-id']).toBe('qa-trace-123');
  });

  test('security headers are set and the framework is not advertised', async ({ request }) => {
    const h = (await request.get('/health')).headers();
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['x-frame-options']).toBeTruthy();
    expect(h['content-security-policy']).toContain("default-src 'self'");
    expect(h['x-powered-by']).toBeUndefined();
  });

  test('metrics are exposed in Prometheus format', async ({ request }) => {
    await request.get('/api/projects');
    const res = await request.get('/metrics', { headers: process.env.METRICS_TOKEN ? { Authorization: `Bearer ${process.env.METRICS_TOKEN}` } : {} });
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toContain('http_request_duration_seconds_bucket');
    expect(text).toContain('process_cpu_user_seconds_total');
  });
});
