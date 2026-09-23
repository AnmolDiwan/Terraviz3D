import { execSync, spawn } from 'child_process';
import http from 'http';

const delay = ms => new Promise(res => setTimeout(res, ms));

async function runTests() {
  console.log('--- Step 1: npm run migrate ---');
  try {
    execSync('npm run migrate', { stdio: 'inherit' });
  } catch (err) {
    console.error('Migration failed!');
    process.exit(1);
  }

  console.log('--- Step 2: npm start ---');
  const server = spawn('node', ['src/server.js'], { stdio: 'pipe' });
  server.stdout.on('data', d => console.log(`[SERVER] ${d}`));
  server.stderr.on('data', d => console.error(`[SERVER ERR] ${d}`));
  
  await delay(3000); // Wait for server to start

  let cookie = '';
  const username = 'testuser_' + Date.now();

  try {
    console.log('--- Step 3: Register ---');
    const r1 = await fetch('http://localhost:4000/api/auth/register', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email: username+'@test.com', password: 'password123' })
    });
    console.log('Register Status:', r1.status);
    if (!r1.ok) throw new Error(await r1.text());

    console.log('--- Step 4: Login ---');
    const r2 = await fetch('http://localhost:4000/api/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: 'password123' })
    });
    console.log('Login Status:', r2.status);
    if (!r2.ok) throw new Error(await r2.text());
    
    cookie = r2.headers.get('set-cookie')?.split(';')[0];
    const loginData = await r2.json();
    console.log('Login Data has token?:', !!loginData.token); // Should be false

    console.log('--- Step 5: Get Me ---');
    const r3 = await fetch('http://localhost:4000/api/auth/me', {
      headers: { 'Cookie': cookie }
    });
    console.log('Get Me Status:', r3.status);
    const meData = await r3.json();
    if (meData.username !== username) throw new Error('User mismatch');

    console.log('--- Step 6: Geo Earthquakes ---');
    const r4 = await fetch('http://localhost:4000/api/geo/earthquakes');
    console.log('Geo Earthquakes Status:', r4.status);

    console.log('--- Step 7: Geo Countries ---');
    const r5 = await fetch('http://localhost:4000/api/geo/countries');
    console.log('Geo Countries Status:', r5.status);

    console.log('--- Step 8: AI Index ---');
    const mockPoints = Array.from({length: 10}).map((_, i) => ({
      lat: 35.0 + i, lng: 139.0 + i, magnitude: 5.5, category: 'earthquake',
      metadata: { place: `Japan Test ${i}`, time: Date.now(), mag: 5.5 }
    }));
    const r6 = await fetch('http://localhost:4000/api/ai/index', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
      body: JSON.stringify({ dataPoints: mockPoints })
    });
    console.log('AI Index Status:', r6.status);
    if (!r6.ok) throw new Error(await r6.text());

    console.log('--- Step 9: AI Query (Japan) ---');
    const r7 = await fetch('http://localhost:4000/api/ai/query', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
      body: JSON.stringify({ query: 'earthquakes in Japan', layerContext: 'earthquake' })
    });
    console.log('AI Query Status:', r7.status);
    if (!r7.ok) throw new Error(await r7.text());
    const queryData1 = await r7.json();
    console.log('Answer 1:', queryData1.answer.slice(0, 50) + '...');

    console.log('--- Step 10: AI Query (Show Japan) ---');
    const r8 = await fetch('http://localhost:4000/api/ai/query', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
      body: JSON.stringify({ query: 'show earthquakes in Japan', layerContext: 'earthquake' })
    });
    console.log('AI Query 2 Status:', r8.status);
    const queryData2 = await r8.json();
    console.log('Markers array length:', queryData2.markers?.length);
    if (!queryData2.markers || queryData2.markers.length === 0) throw new Error('Markers empty');

    console.log('--- Step 11: Rate Limit Test ---');
    let hit429 = false;
    for (let i = 0; i < 11; i++) {
      const r = await fetch('http://localhost:4000/api/ai/query', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Cookie': cookie },
        body: JSON.stringify({ query: 'test rate limit', layerContext: 'earthquake' })
      });
      if (r.status === 429) hit429 = true;
    }
    console.log('Hit 429?', hit429);
    if (!hit429) throw new Error('Did not hit rate limit');

    console.log('--- Step 12: Health Check ---');
    const r12 = await fetch('http://localhost:4000/health');
    console.log('Health Status:', r12.status);
    const healthData = await r12.json();
    console.log('Health Data:', healthData);
    if (healthData.status !== 'ok') throw new Error('Health check failed');

    console.log('ALL BACKEND TESTS PASSED');
  } catch (err) {
    console.error('TEST FAILED:', err);
  } finally {
    server.kill();
    process.exit(0);
  }
}

runTests();
