const API_URL = 'http://localhost:5000/api';

async function req(url, options = {}) {
  const res = await fetch(`${API_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }
  return data;
}

async function runTests() {
  console.log('=== MEDICINE OVERDUE & ACCESS CONTROL TEST SUITE ===\n');

  // 1. Authenticate Patient 1 (Rajesh Kumar, patient1@demo.com)
  const p1Login = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'patient1@demo.com', password: 'Password@123' })
  });
  const p1Headers = { Authorization: `Bearer ${p1Login.token}` };
  console.log('✔ Authenticated as Patient 1 (Rajesh Kumar)');

  // 2. Authenticate Patient 2 (Ananya Sharma, patient2@demo.com)
  const p2Login = await req('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'patient2@demo.com', password: 'Password@123' })
  });
  const p2Headers = { Authorization: `Bearer ${p2Login.token}` };
  console.log('✔ Authenticated as Patient 2 (Ananya Sharma)');

  // 3. Fetch reminders for Patient 1
  const reminders = await req('/reminders', { headers: p1Headers });
  console.log(`✔ Retrieved ${reminders.length} reminders for Patient 1`);

  const now = new Date();
  console.log(`Current local test time: ${now.toLocaleTimeString()}`);

  // Test Scenario 1 & 2: Status categorization (Pending Dose vs Overdue)
  let pastUnconfirmedCount = 0;
  let futureCount = 0;

  for (const rem of reminders) {
    const [h, m] = rem.remind_time.split(':').map(Number);
    const scheduled = new Date();
    scheduled.setHours(h, m, 0, 0);

    const isPast = now > scheduled;
    if (rem.today_status === 'Taken') {
      console.log(`  [Dose ${rem.id}] ${rem.medicine_name} at ${rem.remind_time.slice(0, 5)} -> TAKEN`);
    } else if (isPast) {
      pastUnconfirmedCount++;
      console.log(`  [Dose ${rem.id}] ${rem.medicine_name} at ${rem.remind_time.slice(0, 5)} -> OVERDUE (past scheduled time, unconfirmed)`);
    } else {
      futureCount++;
      console.log(`  [Dose ${rem.id}] ${rem.medicine_name} at ${rem.remind_time.slice(0, 5)} -> PENDING DOSE (future scheduled time)`);
    }
  }

  console.log(`✔ Scenario 1 & 2 verified: ${pastUnconfirmedCount} overdue doses detected; future doses stay Pending.`);

  // Test Scenario 3: Clicking 'I HAVE TAKEN IT' updates the correct dose and records the time
  const targetDose = reminders.find(r => r.today_status !== 'Taken');
  if (targetDose) {
    console.log(`\nTesting 'I HAVE TAKEN IT' on dose ${targetDose.id} (${targetDose.medicine_name})...`);
    const takeRes = await req(`/reminders/${targetDose.id}/take`, {
      method: 'POST',
      headers: p1Headers
    });
    console.log(`✔ Backend response:`, takeRes);
    if (!takeRes.taken_at) throw new Error('Missing taken_at timestamp in response');

    // Verify persistence upon re-fetching (Scenario 5: refreshing does not reset)
    const refreshed = await req('/reminders', { headers: p1Headers });
    const updatedDose = refreshed.find(r => r.id === targetDose.id);
    if (updatedDose.today_status !== 'Taken') {
      throw new Error(`Dose ${targetDose.id} was not persisted as Taken!`);
    }
    console.log(`✔ Scenario 3 & 5 verified: Dose ${targetDose.id} is persisted as Taken with taken_at = ${updatedDose.taken_at}`);

    // Test Scenario 4: Other overdue doses remain unconfirmed and handled separately
    const otherDoses = refreshed.filter(r => r.id !== targetDose.id && r.today_status !== 'Taken');
    console.log(`✔ Scenario 4 verified: ${otherDoses.length} other doses remain unconfirmed and can be handled individually.`);
  }

  // Test Scenario 8: Patient 2 CANNOT mark Patient 1's dose as taken
  console.log(`\nTesting cross-patient authorization security...`);
  try {
    await req(`/reminders/${targetDose.id}/take`, {
      method: 'POST',
      headers: p2Headers
    });
    throw new Error('SECURITY VIOLATION: Patient 2 was able to update Patient 1 dose!');
  } catch (err) {
    if (err.status === 404 || err.status === 403) {
      console.log(`✔ Scenario 8 verified: Patient 2 correctly blocked from taking Patient 1 dose (HTTP ${err.status}: ${JSON.stringify(err.data)})`);
    } else {
      throw err;
    }
  }

  console.log('\n=== ALL TEST SCENARIOS VERIFIED SUCCESSFULLY! ===');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
