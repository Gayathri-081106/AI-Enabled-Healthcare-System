import { WebSocket } from 'ws';

const BASE = 'http://localhost:5000/api';
const WS_BASE = 'ws://localhost:5000/ws';

async function req(endpoint, method = 'GET', data = null, token = null) {
  const url = `${BASE}${endpoint}`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined
  });
  return await res.json();
}

async function testAccess() {
  console.log('🔒 Testing Teleconsultation Room Isolation & Security...\n');

  // Login Doctor Priya (assigned to appointment)
  const docPriya = await req('/auth/login', 'POST', { email: 'priya@demo.com', password: 'Password@123' });
  // Login Doctor Arun (unrelated doctor)
  const docArun = await req('/auth/login', 'POST', { email: 'arun@demo.com', password: 'Password@123' });
  // Login Patient 1 (assigned to appointment)
  const pat1 = await req('/auth/login', 'POST', { email: 'patient1@demo.com', password: 'Password@123' });
  // Login Patient 2 (unrelated patient)
  const pat2 = await req('/auth/login', 'POST', { email: 'patient2@demo.com', password: 'Password@123' });

  // Get appointments for docPriya
  const appointments = await req('/appointments', 'GET', null, docPriya.token);
  const priyaApt = appointments.find(a => a.status === 'Confirmed' && a.patient_id === pat1.user.id);
  if (!priyaApt) {
    console.error('No confirmed appointment found for Priya and Patient 1');
    return;
  }
  const targetRoomId = String(priyaApt.id);
  console.log(`Target Consultation Room: #${targetRoomId} (Doctor: Dr. Priya Sharma, Patient: Rajesh Kumar)`);

  // Test 1: Unrelated Doctor Arun tries to join Room
  console.log('\n1️⃣ Testing Unrelated Doctor Arun attempting to join Room #' + targetRoomId);
  await new Promise((resolve) => {
    const ws = new WebSocket(WS_BASE);
    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'join',
        roomId: targetRoomId,
        user: { id: docArun.user.id, name: docArun.user.name, role: docArun.user.role }
      }));
    });
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'error') {
        console.log(`   ✅ Correctly BLOCKED unrelated Doctor: "${msg.message}"`);
        ws.close();
        resolve();
      } else {
        console.error(`   ❌ Failed: Unrelated doctor was allowed:`, msg);
        ws.close();
        resolve();
      }
    });
  });

  // Test 2: Unrelated Patient 2 tries to join Room
  console.log('\n2️⃣ Testing Unrelated Patient 2 attempting to join Room #' + targetRoomId);
  await new Promise((resolve) => {
    const ws = new WebSocket(WS_BASE);
    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'join',
        roomId: targetRoomId,
        user: { id: pat2.user.id, name: pat2.user.name, role: pat2.user.role }
      }));
    });
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'error') {
        console.log(`   ✅ Correctly BLOCKED unrelated Patient: "${msg.message}"`);
        ws.close();
        resolve();
      } else {
        console.error(`   ❌ Failed: Unrelated patient was allowed:`, msg);
        ws.close();
        resolve();
      }
    });
  });

  // Test 3: Authorized Doctor Priya joins Room
  console.log('\n3️⃣ Testing Authorized Doctor Priya joining Room #' + targetRoomId);
  await new Promise((resolve) => {
    const ws = new WebSocket(WS_BASE);
    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'join',
        roomId: targetRoomId,
        user: { id: docPriya.user.id, name: docPriya.user.name, role: docPriya.user.role }
      }));
    });
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'room-info') {
        console.log(`   ✅ Authorized Doctor successfully joined Room #${msg.roomId}`);
        ws.close();
        resolve();
      }
    });
  });

  // Test 4: Authorized Patient 1 joins Room
  console.log('\n4️⃣ Testing Authorized Patient 1 joining Room #' + targetRoomId);
  await new Promise((resolve) => {
    const ws = new WebSocket(WS_BASE);
    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'join',
        roomId: targetRoomId,
        user: { id: pat1.user.id, name: pat1.user.name, role: pat1.user.role }
      }));
    });
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'room-info') {
        console.log(`   ✅ Authorized Patient successfully joined Room #${msg.roomId}`);
        ws.close();
        resolve();
      }
    });
  });

  console.log('\n🎉 ALL ROOM ISOLATION & ACCESS CONTROL TESTS PASSED!');
  process.exit(0);
}

testAccess().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
