const BASE = 'http://localhost:5000/api';

async function req(path, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.data = data;
    throw err;
  }
  return data;
}

async function runTests() {
  console.log('🧪 Starting MediConnect AI End-to-End System Tests...\n');

  try {
    // 1. Health check
    const health = await req('/health');
    console.log('✅ 1. Server Health Check:', health.status);

    // 2. Login as Patient
    const pLogin = await req('/auth/login', 'POST', {
      email: 'patient1@demo.com',
      password: 'Password@123'
    });
    const pToken = pLogin.token;
    console.log('✅ 2. Patient Login:', pLogin.user.name, `(${pLogin.user.role})`);

    // 3. Login as Doctor
    const dLogin = await req('/auth/login', 'POST', {
      email: 'priya@demo.com',
      password: 'Password@123'
    });
    const dToken = dLogin.token;
    console.log('✅ 3. Doctor Login:', dLogin.user.name, `(${dLogin.user.role})`);

    // 4. Login as Health Worker
    const hwLogin = await req('/auth/login', 'POST', {
      email: 'hw1@demo.com',
      password: 'Password@123'
    });
    const hwToken = hwLogin.token;
    console.log('✅ 4. Health Worker Login:', hwLogin.user.name, `(${hwLogin.user.role})`);

    // 5. Health worker registers a new patient
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const regPatientRes = await req('/health-worker/patients', 'POST', {
      name: `Community Patient ${randomSuffix}`,
      phone: `984210${randomSuffix}`,
      gender: 'Female',
      dob: '1990-05-15',
      address: '74 Rural Ward, Erode',
      language: 'Tamil',
      emergency_contact_name: 'Murugan',
      emergency_contact_phone: '9842109999',
      notes: 'Hypertension monitoring'
    }, hwToken);
    console.log('✅ 5. Health Worker Patient Registration:', regPatientRes.message);
    const newPtId = regPatientRes.id;

    // 6. Health worker logs a home visit for the new patient
    const visitRes = await req('/health-worker/home-visits', 'POST', {
      patient_id: newPtId,
      visit_date: new Date().toISOString().split('T')[0],
      blood_pressure: '124/82 mmHg',
      pulse: '74 bpm',
      blood_sugar: '105 mg/dL',
      temperature: '98.4°F',
      observations: 'Patient visited at home. Vitals normal. Advised hydration.',
      next_followup_date: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0]
    }, hwToken);
    console.log('✅ 6. Health Worker Home Visit Logged:', visitRes.message);

    // 7. Patient books an appointment with Dr. Priya
    const doctorsList = await req('/doctors', 'GET', null, pToken);
    const drPriya = doctorsList.find(d => d.name.includes('Priya')) || doctorsList[0];
    const randomOffset = Math.floor(Math.random() * 20) + 15;
    const targetDate = new Date(Date.now() + 86400000 * randomOffset).toISOString().split('T')[0];
    const hour = (9 + Math.floor(Math.random() * 6)).toString().padStart(2, '0');
    const minute = Math.random() > 0.5 ? '00' : '30';

    const aptBooking = await req('/appointments', 'POST', {
      doctor_id: drPriya.id,
      date: targetDate,
      time: `${hour}:${minute}:00`,
      reason: 'Regular BP evaluation and routine checkup'
    }, pToken);
    console.log('✅ 7. Patient Booked Appointment:', aptBooking.message);
    const aptId = aptBooking.id;

    // 8. Doctor confirms appointment
    const confirmRes = await req(`/appointments/${aptId}/status`, 'PUT', {
      status: 'Confirmed'
    }, dToken);
    console.log('✅ 8. Doctor Confirmed Appointment:', confirmRes.message);

    // 9. Doctor issues prescription
    const medicinesRes = await req('/medicines', 'GET', null, dToken);
    const medId = medicinesRes[0].id;

    const rxRes = await req('/prescriptions', 'POST', {
      appointment_id: aptId,
      patient_id: pLogin.user.id,
      diagnosis: 'Mild Essential Hypertension',
      notes: 'Low salt diet, take morning dose regularly after breakfast.',
      items: [
        {
          medicine_id: medId,
          dosage: '500 mg',
          frequency: 2,
          days: 7,
          instructions: 'Take 1 tablet twice daily after meals'
        }
      ]
    }, dToken);
    console.log('✅ 9. Doctor Issued Prescription:', rxRes.message);

    // 10. Patient checks reminders and logs dose as taken
    const remindersRes = await req('/reminders', 'GET', null, pToken);
    console.log(`✅ 10. Patient Reminders Loaded: ${remindersRes.length} reminders found`);
    if (remindersRes.length > 0) {
      const firstRem = remindersRes[0];
      const takeRes = await req(`/reminders/${firstRem.id}/take`, 'POST', {}, pToken);
      console.log('✅ 10b. Patient Marked Dose as Taken:', takeRes.message);
    }

    // 11. In-call Consultation Message
    await req(`/consultations/${aptId}/messages`, 'POST', {
      text: 'Good morning Dr. Priya, I am ready for the consultation.',
      language: 'English'
    }, pToken);
    console.log('✅ 11. Teleconsultation In-Call Message Sent: OK');

    // 12. AI Health Triage Query
    const aiRes = await req('/ai/query', 'POST', {
      symptoms: 'Mild Fever, Headache',
      query: 'What precautions should I take for mild fever?'
    }, pToken);
    console.log('✅ 12. AI Health Triage Guidance Response Received:');
    console.log('   Preview:', aiRes.response.split('\n')[0]);

    // 13. Nearby Hospitals
    const hospRes = await req('/hospitals/nearby?lat=11.3410&lng=77.7172', 'GET', null, pToken);
    console.log(`✅ 13. Nearby Hospitals Retrieved: ${hospRes.length} facilities found`);
    console.log(`   Closest: ${hospRes[0].name} (${hospRes[0].distance_km} km)`);

    console.log('\n🎉 ALL 13 END-TO-END TESTS PASSED SUCCESSFULLY! 100% OPERATIONAL.');
  } catch (err) {
    console.error('❌ Test Failure:', err.data || err.message);
    process.exit(1);
  }
}

runTests();
