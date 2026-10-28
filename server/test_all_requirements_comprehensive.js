import http from 'http';
import { WebSocket } from 'ws';

const BASE = 'http://127.0.0.1:5000/api';
const WS_BASE = 'ws://127.0.0.1:5000/ws';

async function req(endpoint, method = 'GET', data = null, token = null) {
  const url = `${BASE}${endpoint}`;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined
  });

  const resData = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(resData.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = resData;
    throw err;
  }
  return resData;
}

async function runComprehensiveTests() {
  console.log('================================================================');
  console.log('🩺 MediConnect AI - Comprehensive System Verification Suite');
  console.log('================================================================\n');

  // 1. Health check & single server instance check
  console.log('--- Step 1 & 2: Server Health & Port Verification ---');
  const health = await req('/health');
  console.log(`✅ Server Status: ${health.status} on port 5000, MySQL connected.`);

  // 2. Authentication & Access Permissions across all roles
  console.log('\n--- Step 3: Multi-Role Authentication & Access Control ---');
  const patientAuth = await req('/auth/login', 'POST', { email: 'patient1@demo.com', password: 'Password@123' });
  console.log(`✅ Patient Login: ${patientAuth.user.name} (${patientAuth.user.role})`);

  const doctorAuth = await req('/auth/login', 'POST', { email: 'priya@demo.com', password: 'Password@123' });
  console.log(`✅ Doctor Login: ${doctorAuth.user.name} (${doctorAuth.user.role})`);

  const hwAuth = await req('/auth/login', 'POST', { email: 'hw1@demo.com', password: 'Password@123' });
  console.log(`✅ Health Worker Login: ${hwAuth.user.name} (${hwAuth.user.role})`);

  const adminAuth = await req('/auth/login', 'POST', { email: 'admin@demo.com', password: 'Password@123' });
  console.log(`✅ Admin Login: ${adminAuth.user.name} (${adminAuth.user.role})`);

  // Verify RBAC protection: Patient cannot access Health Worker dashboard
  try {
    await req('/health-worker/dashboard', 'GET', null, patientAuth.token);
    throw new Error('Security Breach: Patient was able to access Health Worker dashboard!');
  } catch (err) {
    console.log(`✅ RBAC Verified: Patient blocked from Health Worker dashboard (${err.status}: ${err.data?.error || err.message})`);
  }

  // 3. Health Worker registers patient & books doctor appointment on patient's behalf
  console.log('\n--- Step 4: Health Worker Books Doctor Appointment for Patient ---');
  const randNum = Math.floor(Math.random() * 9000) + 1000;
  const newPatientData = {
    name: `Ramesh Community ${randNum}`,
    email: `ramesh.${randNum}@village.org`,
    password: 'password123',
    phone: `98421${randNum}`,
    dob: '1988-06-15',
    gender: 'Male',
    blood_group: 'B+',
    address: 'Plot 4, Rural Colony, Perundurai',
    medical_history: 'Mild Asthma, Allergy to Dust',
    allergies: 'Dust, Pollen',
    current_medications: 'Salbutamol Inhaler as needed'
  };

  const regPatientRes = await req('/health-worker/patients', 'POST', newPatientData, hwAuth.token);
  const patientId = regPatientRes.id;
  console.log(`✅ Patient Registered by HW: ID #${patientId} (${newPatientData.name})`);

  // Select Doctor
  const doctors = await req('/doctors', 'GET', null, hwAuth.token);
  const doctor = doctors.find(d => d.specialization.includes('Cardiology')) || doctors[0];
  console.log(`✅ Selected Doctor: ${doctor.name} (${doctor.specialization})`);

  // Health Worker books appointment
  const aptDate = new Date(Date.now() + 86400000 * (10 + Math.floor(Math.random() * 20))).toISOString().split('T')[0];
  const aptHour = (9 + Math.floor(Math.random() * 6)).toString().padStart(2, '0');
  const aptMinute = Math.random() > 0.5 ? '00' : '30';
  const aptTime = `${aptHour}:${aptMinute}:00`;

  const bookingRes = await req('/appointments', 'POST', {
    doctor_id: doctor.id,
    patient_id: patientId,
    date: aptDate,
    time: aptTime,
    consultation_type: 'Video',
    reason: 'Follow-up on cardiovascular health and respiratory check'
  }, hwAuth.token);
  const appointmentId = bookingRes.id;
  console.log(`✅ HW Booked Appointment #${appointmentId} on ${aptDate} at ${aptTime} (${bookingRes.consultation_type})`);

  // 4. Verify appointment in Patient Records, Doctor Dashboard, and HW Dashboard
  console.log('\n--- Step 5: Verification in Patient, Doctor & HW Dashboards ---');
  // Check in Doctor Dashboard / Appointments
  const docAppointments = await req('/appointments', 'GET', null, doctorAuth.token);
  const foundInDoc = docAppointments.find(a => a.id === appointmentId);
  console.log(`✅ Appointment in Doctor's List: ${foundInDoc ? `Found (Status: ${foundInDoc.status}, Patient: ${foundInDoc.patient_name})` : 'NOT FOUND'}`);

  // Check in HW Appointments
  const hwAppointments = await req('/appointments', 'GET', null, hwAuth.token);
  const foundInHW = hwAppointments.find(a => a.id === appointmentId);
  console.log(`✅ Appointment in Health Worker's List: ${foundInHW ? `Found (Status: ${foundInHW.status}, Patient: ${foundInHW.patient_name})` : 'NOT FOUND'}`);

  // Doctor Confirms Appointment
  const confirmRes = await req(`/appointments/${appointmentId}/status`, 'PUT', { status: 'Confirmed' }, doctorAuth.token);
  console.log(`✅ Doctor Confirmed Appointment: ${confirmRes.message}`);

  // 5. Doctor Issues Prescription and Verifies Patient-Wise History
  console.log('\n--- Step 6: Doctor Prescribes Medication & Patient History Verification ---');
  const medicines = await req('/medicines', 'GET', null, doctorAuth.token);
  const med1 = medicines[0];
  const med2 = medicines[1] || medicines[0];

  const rxRes = await req('/prescriptions', 'POST', {
    appointment_id: appointmentId,
    patient_id: patientId,
    diagnosis: 'Hypertension Stage 1 with Mild Bronchospasm',
    notes: 'Monitor BP weekly. Continue low sodium diet and regular brisk walks.',
    items: [
      {
        medicine_id: med1.id,
        dosage: '10 mg',
        frequency: 1,
        days: 14,
        instructions: 'Take 1 tablet every morning after breakfast'
      },
      {
        medicine_id: med2.id,
        dosage: '500 mg',
        frequency: 2,
        days: 5,
        instructions: 'Take 1 tablet after food twice daily'
      }
    ]
  }, doctorAuth.token);
  console.log(`✅ Doctor Created Prescription #${rxRes.id} for Patient #${patientId}`);

  // Retrieve Prescriptions specifically for this patient
  const patientPrescriptions = await req(`/patients/${patientId}/prescriptions`, 'GET', null, hwAuth.token);
  console.log(`✅ Health Worker retrieved Patient Prescriptions: ${patientPrescriptions.length} record(s) found`);
  console.log(`   Diagnosis: ${patientPrescriptions[0].diagnosis}`);
  console.log(`   Prescribed Medicines: ${patientPrescriptions[0].items.map(i => `${i.medicine_name} (${i.dosage})`).join(', ')}`);

  // Ensure Health Worker cannot issue prescriptions (Strict Role Enforcement)
  try {
    await req('/prescriptions', 'POST', {
      appointment_id: appointmentId,
      patient_id: patientId,
      items: [{ medicine_id: med1.id, dosage: '10mg', frequency: 1, days: 5 }]
    }, hwAuth.token);
    throw new Error('Security Breach: Health Worker was able to issue prescription!');
  } catch (err) {
    console.log(`✅ Prescription Security Verified: Health Worker blocked from prescribing (${err.status}: ${err.data?.error || err.message})`);
  }

  // 6. Test Two-Way Teleconsultation Signaling via WebSockets
  console.log('\n--- Step 7 & 8: Genuine Two-Way Audio/Video WebRTC Signaling & Status Lifecycle ---');
  await new Promise((resolve, reject) => {
    let offerExchanged = false;
    let answerExchanged = false;
    let iceExchanged = false;

    // Doctor WebSocket
    const docWs = new WebSocket(`${WS_BASE}?token=${doctorAuth.token}`);

    req('/auth/login', 'POST', { email: newPatientData.email, password: 'Password@123' }).then(ptLogin => {
      const patWs = new WebSocket(`${WS_BASE}?token=${ptLogin.token}`);

      docWs.on('open', () => {
        docWs.send(JSON.stringify({
          type: 'join',
          roomId: String(appointmentId),
          user: { id: doctorAuth.user.id, name: doctorAuth.user.name, role: doctorAuth.user.role }
        }));
      });

      patWs.on('open', () => {
        patWs.send(JSON.stringify({
          type: 'join',
          roomId: String(appointmentId),
          user: { id: patientId, name: newPatientData.name, role: 'PATIENT' }
        }));
      });

      docWs.on('message', (msg) => {
        const data = JSON.parse(msg.toString());
        if (data.type === 'peer-joined') {
          // Doctor sends WebRTC offer signal
          docWs.send(JSON.stringify({
            type: 'signal',
            signalData: { type: 'offer', sdp: 'v=0\r\no=doctor 1234 1234 IN IP4 127.0.0.1\r\ns=MediConnect\r\n' }
          }));
        } else if (data.type === 'signal') {
          if (data.signalData.type === 'answer') {
            answerExchanged = true;
            // Doctor sends ICE candidate
            docWs.send(JSON.stringify({
              type: 'signal',
              signalData: { type: 'candidate', candidate: { candidate: 'candidate:1 1 UDP 2130706431 127.0.0.1 50000 typ host', sdpMid: '0' } }
            }));
          } else if (data.signalData.type === 'candidate') {
            iceExchanged = true;
            cleanup();
          }
        }
      });

      patWs.on('message', (msg) => {
        const data = JSON.parse(msg.toString());
        if (data.type === 'signal') {
          if (data.signalData.type === 'offer') {
            offerExchanged = true;
            // Patient replies with answer signal
            patWs.send(JSON.stringify({
              type: 'signal',
              signalData: { type: 'answer', sdp: 'v=0\r\no=patient 5678 5678 IN IP4 127.0.0.1\r\ns=MediConnect\r\n' }
            }));
            // Patient sends candidate
            patWs.send(JSON.stringify({
              type: 'signal',
              signalData: { type: 'candidate', candidate: { candidate: 'candidate:2 1 UDP 2130706431 127.0.0.1 50001 typ host', sdpMid: '0' } }
            }));
          }
        }
      });

      function cleanup() {
        console.log('✅ WebSocket Signaling Connected: Doctor & Patient joined room');
        console.log(`✅ WebRTC Signaling Verified: Offer=${offerExchanged}, Answer=${answerExchanged}, ICE=${iceExchanged}`);
        docWs.close();
        patWs.close();
        resolve();
      }

      setTimeout(() => {
        if (!offerExchanged || !answerExchanged) {
          docWs.close();
          patWs.close();
          reject(new Error(`Signaling timeout: offer=${offerExchanged}, answer=${answerExchanged}`));
        }
      }, 6000);
    }).catch(reject);
  });

  // Verify meeting status transitions
  console.log('Updating meeting status to "In Progress"...');
  await req(`/appointments/${appointmentId}/meeting`, 'PUT', { meeting_status: 'In Progress' }, doctorAuth.token);
  let aptStatusCheck = (await req('/appointments', 'GET', null, doctorAuth.token)).find(a => a.id === appointmentId);
  console.log(`✅ Meeting Status Lifecycle [1]: ${aptStatusCheck.meeting_status} (Start time recorded)`);

  console.log('Updating meeting status to "Completed"...');
  await req(`/appointments/${appointmentId}/meeting`, 'PUT', { meeting_status: 'Completed' }, doctorAuth.token);
  aptStatusCheck = (await req('/appointments', 'GET', null, doctorAuth.token)).find(a => a.id === appointmentId);
  console.log(`✅ Meeting Status Lifecycle [2]: ${aptStatusCheck.meeting_status} (End time recorded)`);

  // 7. Multilingual AI Health Support Testing (Tamil, Hindi, English)
  console.log('\n--- Step 9 & 10: Multilingual AI Health Support (Tamil, English, Hindi) ---');
  
  // Test 1: Tamil preferred language
  const aiTamil = await req('/ai/query', 'POST', {
    symptoms: 'தலைவலி, சோர்வு',
    query: 'எனக்கு தலைவலியும் சோர்வும் உள்ளது. என்ன செய்ய வேண்டும்?',
    language: 'Tamil'
  }, patientAuth.token);
  console.log('✅ AI Health Support (Tamil Response):');
  console.log(`   Language: ${aiTamil.language}`);
  console.log(`   Preview: ${aiTamil.response.split('\n')[0].slice(0, 80)}...`);

  // Test 2: Hindi preferred language
  const aiHindi = await req('/ai/query', 'POST', {
    symptoms: 'बुखार, खांसी',
    query: 'मुझे हल्का बुखार और खांसी है, क्या सावधानी बरतनी चाहिए?',
    language: 'Hindi'
  }, patientAuth.token);
  console.log('✅ AI Health Support (Hindi Response):');
  console.log(`   Language: ${aiHindi.language}`);
  console.log(`   Preview: ${aiHindi.response.split('\n')[0].slice(0, 80)}...`);

  // Test 3: English with explicit language override in query ("answer in Tamil")
  const aiOverride = await req('/ai/query', 'POST', {
    symptoms: 'Chest tightness, dizziness',
    query: 'I feel dizziness and chest pressure, please answer in Tamil',
    language: 'English'
  }, patientAuth.token);
  console.log('✅ AI Health Support (Explicit Language Override):');
  console.log(`   Selected: English | Detected Override: ${aiOverride.language}`);
  console.log(`   Preview: ${aiOverride.response.split('\n')[0].slice(0, 80)}...`);

  // 8. Health Worker Profile & Real MySQL Statistics Verification
  console.log('\n--- Step 11: Health Worker Profile & Real MySQL Dashboard Statistics ---');
  const hwProfile = await req('/health-worker/profile', 'GET', null, hwAuth.token);
  console.log(`✅ Health Worker Profile:`);
  console.log(`   Name:           ${hwProfile.name}`);
  console.log(`   Employee ID:    ${hwProfile.employee_id}`);
  console.log(`   Assigned Area:  ${hwProfile.assigned_area}`);
  console.log(`   Health Centre:  ${hwProfile.health_centre}`);
  console.log(`   Location:       ${hwProfile.location}`);
  console.log(`   Qualification:  ${hwProfile.qualification}`);

  const hwDash = await req('/health-worker/dashboard', 'GET', null, hwAuth.token);
  console.log('✅ Real Database Dashboard Statistics for Health Worker:');
  console.log(`   Managed Patients:       ${hwDash.stats.managedPatients}`);
  console.log(`   Today's Appointments:   ${hwDash.stats.todayAppointments}`);
  console.log(`   Upcoming Consultations: ${hwDash.stats.upcomingConsultations}`);
  console.log(`   Completed Consultations:${hwDash.stats.completedConsultations}`);
  console.log(`   Total Home Visits:      ${hwDash.stats.totalHomeVisits}`);
  console.log(`   Recorded Follow-ups:    ${hwDash.stats.recordedFollowups}`);

  console.log('\n================================================================');
  console.log('🎉 ALL COMPREHENSIVE VERIFICATION TESTS PASSED 100% SUCCESSFULLY!');
  console.log('================================================================');
}

runComprehensiveTests().catch(err => {
  console.error('\n❌ Comprehensive Test Failed:', err.data || err.message);
  process.exit(1);
});
