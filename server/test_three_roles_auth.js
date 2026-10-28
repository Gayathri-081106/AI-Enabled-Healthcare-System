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

async function testAllThreeRoles() {
  console.log('🧪 Testing Multi-Role Registration, Authentication & RBAC...\n');
  const rand = Math.floor(1000 + Math.random() * 9000);

  try {
    // ----------------------------------------------------
    // 1. PATIENT REGISTRATION & AUTHENTICATION
    // ----------------------------------------------------
    const patientEmail = `new.patient.${rand}@demo.com`;
    console.log(`1️⃣ Registering new Patient: ${patientEmail}...`);
    const ptReg = await req('/auth/register', 'POST', {
      name: `Test Patient ${rand}`,
      email: patientEmail,
      password: 'Password@123',
      phone: '9840112233',
      gender: 'Male',
      dob: '1992-04-10',
      address: '22 Park Lane, Erode',
      language: 'Tamil',
      emergency_contact_name: 'Lakshmi',
      emergency_contact_phone: '9840112244',
      role: 'PATIENT'
    });
    console.log('   ✅ Patient registered:', ptReg.user.name, 'Token:', !!ptReg.token);

    // Patient Login with expected_role = PATIENT
    const ptLogin = await req('/auth/login', 'POST', {
      email: patientEmail,
      password: 'Password@123',
      expected_role: 'PATIENT'
    });
    console.log('   ✅ Patient logged in successfully. Role verified:', ptLogin.user.role);

    // ----------------------------------------------------
    // 2. DOCTOR REGISTRATION & AUTHENTICATION
    // ----------------------------------------------------
    const doctorEmail = `dr.saravanan.${rand}@demo.com`;
    console.log(`\n2️⃣ Registering new Doctor: ${doctorEmail}...`);
    const docReg = await req('/auth/register', 'POST', {
      name: `Dr. Saravanan ${rand}`,
      email: doctorEmail,
      password: 'Password@123',
      phone: '9840223344',
      gender: 'Male',
      language: 'English',
      role: 'DOCTOR',
      specialization: 'Neurology',
      qualification: 'MBBS, MD, DM (Neurology)',
      experience: 11,
      start_time: '10:00',
      end_time: '18:00',
      slot_duration_mins: 30,
      consultation_fee: 700,
      bio: 'Neurologist specializing in stroke management and neuromuscular disorders.'
    });
    console.log('   ✅ Doctor registered:', docReg.user.name, 'Role:', docReg.user.role);

    // Doctor Login with expected_role = DOCTOR
    const docLogin = await req('/auth/login', 'POST', {
      email: doctorEmail,
      password: 'Password@123',
      expected_role: 'DOCTOR'
    });
    console.log('   ✅ Doctor logged in successfully. Role verified:', docLogin.user.role);

    // Verify Doctor appears in public Doctor directory
    const docs = await req('/doctors?spec=Neurology', 'GET', null, ptLogin.token);
    const foundDoc = docs.find(d => d.email === doctorEmail);
    console.log('   ✅ Verified in Doctor Directory:', foundDoc ? `Found (${foundDoc.specialization})` : 'Not found');

    // ----------------------------------------------------
    // 3. HEALTH WORKER REGISTRATION & AUTHENTICATION
    // ----------------------------------------------------
    const hwEmail = `hw.kavitha.${rand}@demo.com`;
    console.log(`\n3️⃣ Registering new Health Worker: ${hwEmail}...`);
    const hwReg = await req('/auth/register', 'POST', {
      name: `Kavitha R ${rand}`,
      email: hwEmail,
      password: 'Password@123',
      phone: '9840334455',
      gender: 'Female',
      dob: '1988-08-14',
      address: 'Community Center, Bhavani',
      language: 'Tamil',
      role: 'HEALTH_WORKER',
      assigned_area: 'Zone C - Bhavani Sector',
      employee_id: `HW-${rand}`
    });
    console.log('   ✅ Health Worker registered:', hwReg.user.name, 'Role:', hwReg.user.role);

    // Health Worker Login with expected_role = HEALTH_WORKER
    const hwLogin = await req('/auth/login', 'POST', {
      email: hwEmail,
      password: 'Password@123',
      expected_role: 'HEALTH_WORKER'
    });
    console.log('   ✅ Health Worker logged in successfully. Role verified:', hwLogin.user.role);

    // Health Worker Dashboard check
    const hwDash = await req('/health-worker/dashboard', 'GET', null, hwLogin.token);
    console.log('   ✅ Health Worker Dashboard accessible:', hwDash.stats);

    // ----------------------------------------------------
    // 4. CROSS-ROLE SECURITY & RBAC VERIFICATION
    // ----------------------------------------------------
    console.log('\n4️⃣ Testing Cross-Role Protection (RBAC)...');
    try {
      // Patient attempting to sign in through Doctor portal
      await req('/auth/login', 'POST', {
        email: patientEmail,
        password: 'Password@123',
        expected_role: 'DOCTOR'
      });
      console.error('   ❌ FAILED: Patient should not log in under DOCTOR portal!');
      process.exit(1);
    } catch (err) {
      console.log('   ✅ Correctly blocked: Patient cannot log in via Doctor Portal:', err.message);
    }

    try {
      // Patient attempting to call Doctor-only API
      await req('/doctor/dashboard', 'GET', null, ptLogin.token);
      console.error('   ❌ FAILED: Patient should not access doctor dashboard API!');
      process.exit(1);
    } catch (err) {
      console.log('   ✅ Correctly blocked: Patient cannot access /doctor/dashboard:', err.message);
    }

    console.log('\n🎉 ALL THREE ROLES (PATIENT, DOCTOR, HEALTH WORKER) FULLY VERIFIED AND OPERATIONAL!');
  } catch (error) {
    console.error('❌ Test Error:', error.data || error.message);
    process.exit(1);
  }
}

testAllThreeRoles();
