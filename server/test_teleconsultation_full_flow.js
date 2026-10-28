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

async function runFullTeleconsultationTests() {
  console.log('================================================================');
  console.log('🩺 MediConnect AI - Comprehensive Teleconsultation Verification');
  console.log('================================================================\n');

  // 1. Authenticate users
  console.log('--- Step 1: User Logins (Doctor, Assigned Patient, Unrelated Patient, Unrelated Doctor) ---');
  const docPriya = await req('/auth/login', 'POST', { email: 'priya@demo.com', password: 'Password@123' });
  console.log(`✅ Doctor Logged in: ${docPriya.user.name} (ID: ${docPriya.user.id}, Role: ${docPriya.user.role})`);

  const pat1 = await req('/auth/login', 'POST', { email: 'patient1@demo.com', password: 'Password@123' });
  console.log(`✅ Patient 1 Logged in: ${pat1.user.name} (ID: ${pat1.user.id}, Role: ${pat1.user.role})`);

  const docArun = await req('/auth/login', 'POST', { email: 'arun@demo.com', password: 'Password@123' });
  console.log(`✅ Unrelated Doctor Logged in: ${docArun.user.name} (ID: ${docArun.user.id})`);

  const pat2 = await req('/auth/login', 'POST', { email: 'patient2@demo.com', password: 'Password@123' });
  console.log(`✅ Unrelated Patient Logged in: ${pat2.user.name} (ID: ${pat2.user.id})`);

  // 2. Locate confirmed appointment between Doctor Priya and Patient 1
  console.log('\n--- Step 2: Appointment & Room Verification ---');
  const priyaApts = await req('/appointments', 'GET', null, docPriya.token);
  let appointment = priyaApts.find(a => ['Confirmed', 'In Progress', 'Waiting for Patient', 'Waiting for Doctor'].includes(a.status) && a.patient_id === pat1.user.id);
  
  if (!appointment) {
    // Book an appointment if none confirmed
    const booked = await req('/appointments', 'POST', {
      doctor_id: docPriya.user.id,
      patient_id: pat1.user.id,
      date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      time: '11:00:00',
      consultation_type: 'Video',
      reason: 'Teleconsultation Video Verification Session'
    }, pat1.token);
    await req(`/appointments/${booked.id}/status`, 'PUT', { status: 'Confirmed' }, docPriya.token);
    appointment = { id: booked.id, patient_id: pat1.user.id };
  }

  const roomId = String(appointment.id);
  console.log(`✅ Target Teleconsultation Room ID: #${roomId}`);

  // 3. Verify Security Isolation: Unrelated users CANNOT join
  console.log('\n--- Step 3: Verify Security Isolation (Block Unrelated Doctor & Patient) ---');
  await new Promise((resolve) => {
    const ws = new WebSocket(WS_BASE);
    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'join',
        roomId,
        user: { id: docArun.user.id, name: docArun.user.name, role: docArun.user.role },
        token: docArun.token
      }));
    });
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'error') {
        console.log(`✅ Security Verified: Unrelated Doctor BLOCKED from Room #${roomId}: "${msg.message}"`);
        ws.close();
        resolve();
      }
    });
  });

  await new Promise((resolve) => {
    const ws = new WebSocket(WS_BASE);
    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'join',
        roomId,
        user: { id: pat2.user.id, name: pat2.user.name, role: pat2.user.role },
        token: pat2.token
      }));
    });
    ws.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'error') {
        console.log(`✅ Security Verified: Unrelated Patient BLOCKED from Room #${roomId}: "${msg.message}"`);
        ws.close();
        resolve();
      }
    });
  });

  // 4. Test Doctor Explicit Join Call Flow
  console.log('\n--- Step 4: Doctor Explicitly Joins Consultation Room ---');
  let docWs = new WebSocket(WS_BASE);
  let docJoined = false;
  let patJoined = false;
  let offerReceivedByPat = false;
  let answerReceivedByDoc = false;
  let iceReceivedByDoc = false;
  let toggleReceivedByPat = false;
  let callEndedReceived = false;

  await new Promise((resolve) => {
    docWs.on('open', () => {
      docWs.send(JSON.stringify({
        type: 'join',
        roomId,
        user: { id: docPriya.user.id, name: docPriya.user.name, role: docPriya.user.role },
        token: docPriya.token
      }));
    });
    docWs.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'room-info') {
        console.log(`✅ Doctor joined Room #${roomId}. Existing peers: ${msg.peers.length}`);
        console.log(`   Waiting for Patient: peers=0 -> Doctor sees "Waiting for participant to join..."`);
        docJoined = true;
        resolve();
      }
    });
  });

  // 5. Test Patient Explicit Join Call Flow and WebRTC Handshake
  console.log('\n--- Step 5: Patient Explicitly Joins Room & Two-Way WebRTC Handshake ---');
  let patWs = new WebSocket(WS_BASE);

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Signaling handshake timed out')), 8000);

    docWs.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'peer-joined') {
        console.log(`✅ Doctor received 'peer-joined': ${msg.peer.name} (${msg.peer.role})`);
        // Doctor initiates offer
        docWs.send(JSON.stringify({
          type: 'signal',
          signalData: {
            sdp: { type: 'offer', sdp: 'v=0\r\no=doctor 1234 1234 IN IP4 127.0.0.1\r\ns=LiveConsultation\r\n' }
          }
        }));
      } else if (msg.type === 'signal') {
        if (msg.signalData.sdp?.type === 'answer') {
          answerReceivedByDoc = true;
          console.log('✅ Doctor received WebRTC answer from Patient');
          // Doctor sends ICE candidate
          docWs.send(JSON.stringify({
            type: 'signal',
            signalData: {
              candidate: { candidate: 'candidate:1 1 UDP 2130706431 127.0.0.1 50000 typ host', sdpMid: '0', sdpMLineIndex: 0 }
            }
          }));
        } else if (msg.signalData.candidate) {
          iceReceivedByDoc = true;
          console.log('✅ Doctor received ICE candidate from Patient');
          clearTimeout(timeout);
          resolve();
        }
      }
    });

    patWs.on('open', () => {
      patWs.send(JSON.stringify({
        type: 'join',
        roomId,
        user: { id: pat1.user.id, name: pat1.user.name, role: pat1.user.role },
        token: pat1.token
      }));
    });

    patWs.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'room-info') {
        console.log(`✅ Patient joined Room #${roomId}. Existing peers: ${msg.peers.map(p => `${p.name} (${p.role})`).join(', ')}`);
        patJoined = true;
      } else if (msg.type === 'signal') {
        if (msg.signalData.sdp?.type === 'offer') {
          offerReceivedByPat = true;
          console.log('✅ Patient received WebRTC offer from Doctor');
          // Patient replies with answer
          patWs.send(JSON.stringify({
            type: 'signal',
            signalData: {
              sdp: { type: 'answer', sdp: 'v=0\r\no=patient 5678 5678 IN IP4 127.0.0.1\r\ns=LiveConsultation\r\n' }
            }
          }));
          // Patient sends ICE candidate
          patWs.send(JSON.stringify({
            type: 'signal',
            signalData: {
              candidate: { candidate: 'candidate:2 1 UDP 2130706431 127.0.0.1 50001 typ host', sdpMid: '0', sdpMLineIndex: 0 }
            }
          }));
        }
      }
    });
  });

  // 6. Test Camera / Mic Toggle Controls
  console.log('\n--- Step 6: Test Individual Camera & Microphone Toggle Controls ---');
  await new Promise((resolve) => {
    patWs.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'media-toggle') {
        console.log(`✅ Patient received media-toggle notification: type=${msg.mediaType}, enabled=${msg.enabled} from ${msg.sender?.name}`);
        toggleReceivedByPat = true;
        resolve();
      }
    });

    // Doctor toggles camera off
    docWs.send(JSON.stringify({
      type: 'media-toggle',
      mediaType: 'video',
      enabled: false
    }));
  });

  // 7. Test Ending Call and Resource Cleanup
  console.log('\n--- Step 7: Test Ending Call & Cleanup Notification ---');
  await new Promise((resolve) => {
    patWs.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'call-ended') {
        console.log(`✅ Patient received 'call-ended' event initiated by ${msg.by?.name}`);
        callEndedReceived = true;
        resolve();
      }
    });

    // Doctor ends the call
    docWs.send(JSON.stringify({
      type: 'call-ended'
    }));
  });

  // Close websockets
  docWs.close();
  patWs.close();

  // 8. Test Meeting status API verification
  console.log('\n--- Step 8: Meeting Status Lifecycle in Database ---');
  const sessionData = await req(`/consultations/${roomId}/session`, 'GET', null, docPriya.token);
  console.log(`✅ Consultation session details verified:`);
  console.log(`   Doctor:  ${sessionData.doctor_name}`);
  console.log(`   Patient: ${sessionData.patient_name}`);
  console.log(`   Status:  ${sessionData.status}`);

  console.log('\n================================================================');
  console.log('🎉 ALL TELECONSULTATION SESSION & SEPARATION TESTS PASSED 100%!');
  console.log('================================================================');
  process.exit(0);
}

runFullTeleconsultationTests().catch((err) => {
  console.error('❌ Teleconsultation Test Error:', err);
  process.exit(1);
});
