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
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function verifyDemoButtonsFlow() {
  console.log('🧪 Verifying Demo Doctor & Health Worker Authentication and Dashboards...\n');

  try {
    // ----------------------------------------------------
    // TEST 1: DOCTOR DEMO BUTTON FLOW
    // ----------------------------------------------------
    console.log('1️⃣ Triggering Doctor "Try Demo" flow (priya@demo.com)...');
    const docLogin = await req('/auth/login', 'POST', {
      email: 'priya@demo.com',
      password: 'Password@123',
      expected_role: 'DOCTOR'
    });
    console.log(`   ✅ Authenticated: ${docLogin.user.name} (Role: ${docLogin.user.role})`);
    const docToken = docLogin.token;

    // Fetch Doctor Dashboard data
    const docDash = await req('/doctor/dashboard', 'GET', null, docToken);
    console.log('   ✅ Doctor Dashboard Statistics (from MySQL):', docDash.stats);
    console.log(`   ✅ Upcoming Appointments count: ${docDash.upcoming.length}`);

    // Fetch Doctor's Associated Patients
    const docPatients = await req('/doctor/patients', 'GET', null, docToken);
    console.log(`   ✅ Doctor Patients Loaded: ${docPatients.length} patient(s) found`);
    if (docPatients.length > 0) {
      console.log(`      Sample Patient: ${docPatients[0].name} (${docPatients[0].phone || docPatients[0].email})`);
    }

    // Fetch Doctor's Prescriptions
    const docRxs = await req('/prescriptions', 'GET', null, docToken);
    console.log(`   ✅ Doctor Prescriptions Loaded: ${docRxs.length} prescription(s) found`);

    // Fetch Doctor's Profile & Availability
    const docProfile = await req('/auth/me', 'GET', null, docToken);
    console.log('   ✅ Doctor Profile Verified:');
    console.log(`      Specialization: ${docProfile.doctorInfo?.specialization}`);
    console.log(`      Qualification:  ${docProfile.doctorInfo?.qualification}`);
    console.log(`      Hours:          ${docProfile.doctorInfo?.start_time} - ${docProfile.doctorInfo?.end_time}`);
    console.log(`      Fee:            ₹${docProfile.doctorInfo?.consultation_fee}`);

    // ----------------------------------------------------
    // TEST 2: HEALTH WORKER DEMO BUTTON FLOW
    // ----------------------------------------------------
    console.log('\n2️⃣ Triggering Health Worker "Try Demo" flow (hw1@demo.com)...');
    const hwLogin = await req('/auth/login', 'POST', {
      email: 'hw1@demo.com',
      password: 'Password@123',
      expected_role: 'HEALTH_WORKER'
    });
    console.log(`   ✅ Authenticated: ${hwLogin.user.name} (Role: ${hwLogin.user.role})`);
    const hwToken = hwLogin.token;

    // Fetch Health Worker Dashboard data
    const hwDash = await req('/health-worker/dashboard', 'GET', null, hwToken);
    console.log('   ✅ Health Worker Dashboard Statistics (from MySQL):', hwDash.stats);
    console.log(`   ✅ Recent Home Visits count: ${hwDash.recentVisits.length}`);

    // Fetch Assigned Patients
    const hwPatients = await req('/health-worker/patients', 'GET', null, hwToken);
    console.log(`   ✅ Assigned Patients Loaded: ${hwPatients.length} community patient(s)`);
    if (hwPatients.length > 0) {
      console.log(`      Sample Community Patient: ${hwPatients[0].name} (ID #${hwPatients[0].id})`);
    }

    // Fetch Home Visit Records & Vitals
    const hwVisits = await req('/health-worker/home-visits', 'GET', null, hwToken);
    console.log(`   ✅ Home Visits & Vitals Loaded: ${hwVisits.length} record(s)`);
    if (hwVisits.length > 0) {
      console.log(`      Latest Visit: Patient ${hwVisits[0].patient_name} - BP: ${hwVisits[0].blood_pressure}, Sugar: ${hwVisits[0].blood_sugar}`);
    }

    // Fetch Health Worker Profile
    const hwProfile = await req('/auth/me', 'GET', null, hwToken);
    console.log('   ✅ Health Worker Profile Verified:');
    console.log(`      Assigned Area: ${hwProfile.healthWorkerInfo?.assigned_area}`);
    console.log(`      Employee ID:   ${hwProfile.healthWorkerInfo?.employee_id}`);
    console.log(`      Qualification: ${hwProfile.healthWorkerInfo?.qualification}`);

    console.log('\n🎉 BOTH DEMO FLOWS (DOCTOR & HEALTH WORKER) VERIFIED WITH REAL MYSQL DATA!');
  } catch (err) {
    console.error('❌ Verification Error:', err.data || err.message);
    process.exit(1);
  }
}

verifyDemoButtonsFlow();
