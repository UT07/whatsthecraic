const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { app, pool } = require('../index');

const request = (url) => new Promise((resolve, reject) => {
  const req = http.get(url, (res) => {
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => resolve({ status: res.statusCode, body: data }));
  });
  req.on('error', reject);
});

const withServer = async (handler) => {
  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const { port } = server.address();
  try {
    await handler(port);
  } finally {
    server.close();
    if (pool && typeof pool.end === 'function') {
      await pool.end();
    }
  }
};

test('auth-service health + metrics', async () => {
  await withServer(async (port) => {
    const health = await request(`http://localhost:${port}/health`);
    assert.equal(health.status, 200);
    const healthBody = JSON.parse(health.body);
    assert.equal(healthBody.status, 'ok');

    const metrics = await request(`http://localhost:${port}/metrics`);
    assert.equal(metrics.status, 200);
    const metricsBody = JSON.parse(metrics.body);
    assert.ok(typeof metricsBody.uptime_seconds === 'number');
  });
});
