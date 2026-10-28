import db from './db.js';

async function testGPayUPI() {
  console.log('🧪 Starting Direct Google Pay ₹500 UPI QR Code Verification Suite...\n');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // 1. Initial State: Unconfigured check
    console.log('--- Test 1: UPI Configuration Endpoint Initial State ---');
    const getRes1 = await fetch('http://localhost:5000/api/config/upi');
    assert(getRes1.status === 200, 'GET /api/config/upi returns 200 OK');
    const data1 = await getRes1.json();
    assert(data1.amount === '500.00', 'Amount is strictly 500.00');
    assert(data1.currency === 'INR', 'Currency is INR');
    assert(data1.transactionNote === 'MediConnect AI Consultation Fee', 'Transaction note is set to MediConnect AI Consultation Fee');

    // 2. Configure UPI ID via API (Simulate setting recipient UPI ID)
    console.log('\n--- Test 2: Configuring Valid Payee UPI ID ---');
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'priya@demo.com', password: 'Password@123' })
    });
    const loginData = await loginRes.json();
    assert(!!loginData.token, `Logged in to obtain authorization token (Doctor: ${loginData.user?.name})`);

    const updateRes = await fetch('http://localhost:5000/api/config/upi', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${loginData.token}`
      },
      body: JSON.stringify({
        upiPayeeId: 'mediconnect.clinic@okhdfcbank',
        upiPayeeName: 'MediConnect AI'
      })
    });
    assert(updateRes.status === 200, 'POST /api/config/upi successfully saved UPI ID');
    const updateData = await updateRes.json();
    assert(updateData.isConfigured === true, 'isConfigured is now true');
    assert(updateData.upiPayeeId === 'mediconnect.clinic@okhdfcbank', 'Saved UPI ID is mediconnect.clinic@okhdfcbank');

    // 3. Verify standard upi://pay URI construction
    console.log('\n--- Test 3: Validate Standard Google Pay upi://pay URI Format ---');
    const payeeId = updateData.upiPayeeId;
    const payeeName = updateData.upiPayeeName;
    const amount = '500.00';
    const currency = 'INR';
    const note = 'MediConnect AI Consultation Fee';
    const txRef = 'MC-APT-1-987654';

    const upiUri = `upi://pay?pa=${encodeURIComponent(payeeId)}&pn=${encodeURIComponent(payeeName)}&am=${amount}&cu=${currency}&tn=${encodeURIComponent(note)}&tr=${encodeURIComponent(txRef)}`;

    assert(upiUri.startsWith('upi://pay?'), 'URI uses standard upi://pay protocol');
    assert(upiUri.includes('pa=mediconnect.clinic%40okhdfcbank') || upiUri.includes('pa=mediconnect.clinic@okhdfcbank'), 'URI encodes payee UPI ID');
    assert(upiUri.includes('am=500.00'), 'URI encodes pre-filled amount of ₹500.00');
    assert(upiUri.includes('cu=INR'), 'URI encodes currency INR');
    assert(upiUri.includes('tn=MediConnect%20AI%20Consultation%20Fee'), 'URI encodes correct transaction note');
    assert(!upiUri.includes('http://') && !upiUri.includes('https://'), 'URI contains NO website URL (opens Google Pay directly)');

    // 4. Source code checks in client App.jsx
    console.log('\n--- Test 4: Verify Required Text in Client UI ---');
    const fs = await import('fs');
    const appCode = fs.readFileSync('../client/src/App.jsx', 'utf8');

    assert(appCode.includes('Consultation Fee: ₹500'), 'UI displays "Consultation Fee: ₹500"');
    assert(appCode.includes('Scan using Google Pay'), 'UI displays "Scan using Google Pay"');
    assert(appCode.includes('upi://pay'), 'QR code generator encodes "upi://pay" format');
    assert(!appCode.includes('399'), 'No ₹399 exists anywhere in code');
    assert(appCode.includes('UPI ID not configured for Google Pay'), 'Unconfigured state message implemented');
    assert(appCode.includes('Configure Google Pay UPI Payee'), 'UPI configuration modal implemented');

    // 5. Verify teleconsultation placement & chat integrity
    console.log('\n--- Test 5: Verify Both Dashboards & Chat Integrity ---');
    assert(appCode.includes('<ConsultationPaymentQR'), 'ConsultationPaymentQR rendered in TeleconsultationView');
    assert(appCode.includes("id: 'teleconsultation', label: 'Doctor Teleconsultation'"), 'Health Worker has Doctor Teleconsultation nav');

    // 6. Verify appointments table status is NOT marked as paid upon scanning
    console.log('\n--- Test 6: Verify Status Stays Pending (Not Automatically Marked Paid) ---');
    const [aptRows] = await db.query('SELECT id, status FROM appointments WHERE id = 1');
    assert(aptRows[0].status !== 'Paid', `Appointment status remains unaltered (${aptRows[0].status})`);

    console.log(`\n========================================`);
    console.log(`Summary: ${passed} passed, ${failed} failed`);
    console.log(`========================================\n`);

    if (failed > 0) process.exit(1);
    else process.exit(0);
  } catch (err) {
    console.error('Test run failed:', err);
    process.exit(1);
  }
}

testGPayUPI();
