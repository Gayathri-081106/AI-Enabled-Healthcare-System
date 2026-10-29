import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import db from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function initAndSeed() {
  console.log('🔄 Initializing MediConnect AI Database...');

  // 1. Read schema.sql and execute
  const schemaPath = path.join(__dirname, '../database/schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  // Strip SQL comments
  const cleanSql = schemaSql
    .replace(/--.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');

  const statements = cleanSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const statement of statements) {
    // On hosted cloud databases (Aiven, TiDB, PlanetScale, Railway), CREATE DATABASE or USE statements may be restricted
    const upper = statement.trim().toUpperCase();
    if (upper.startsWith('CREATE DATABASE') || upper.startsWith('USE ')) {
      try {
        await db.query(statement);
      } catch (err) {
        // Safe to ignore on hosted databases where the database name is pre-allocated
        console.log(`ℹ️ Database initialization notice (${statement.slice(0, 30)}...): ${err.message}`);
      }
      continue;
    }

    try {
      await db.query(statement);
    } catch (err) {
      console.warn('Schema execution note:', err.message, statement.slice(0, 50));
    }
  }
  console.log('✅ Tables created or updated.');

  // 2. Hash password for demo accounts
  const hash = await bcrypt.hash('Password@123', 10);

  // Helper to insert or get user
  async function upsertUser(name, email, role, phone, gender = 'Other', dob = '1995-01-01', address = 'Erode, Tamil Nadu', language = 'English') {
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      await db.query('UPDATE users SET role = ?, name = ?, phone = ?, gender = ?, dob = ?, address = ?, language = ? WHERE id = ?',
        [role, name, phone, gender, dob, address, language, existing[0].id]);
      return existing[0].id;
    }
    const [res] = await db.query(
      'INSERT INTO users (name, email, password_hash, role, phone, gender, dob, address, language) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [name, email, hash, role, phone, gender, dob, address, language]
    );
    return res.insertId;
  }

  // 3. Create Admin
  await upsertUser('System Admin', 'admin@demo.com', 'ADMIN', '9876543210', 'Other', '1988-05-12', 'Central Hospital HQ');

  // 4. Create Doctors
  const doctorsList = [
    {
      name: 'Dr. Priya Sharma',
      email: 'priya@demo.com',
      spec: 'Cardiology',
      exp: 12,
      qual: 'MBBS, MD (Cardiology)',
      start: '09:00:00',
      end: '16:00:00',
      fee: 600,
      bio: 'Senior Interventional Cardiologist specializing in preventive cardiology and hypertension management.'
    },
    {
      name: 'Dr. Arun Patel',
      email: 'arun@demo.com',
      spec: 'General Medicine',
      exp: 9,
      qual: 'MBBS, MD (General Medicine)',
      start: '08:30:00',
      end: '17:30:00',
      fee: 400,
      bio: 'Experienced physician focused on diabetes management, adult acute care, and lifestyle medicine.'
    },
    {
      name: 'Dr. Meena Iyer',
      email: 'meena@demo.com',
      spec: 'Pediatrics',
      exp: 7,
      qual: 'MBBS, DCH, MD (Pediatrics)',
      start: '10:00:00',
      end: '18:00:00',
      fee: 500,
      bio: 'Consultant pediatrician dedicated to child development, pediatric vaccinations, and adolescent healthcare.'
    }
  ];

  const doctorMap = {};
  for (const doc of doctorsList) {
    const userId = await upsertUser(doc.name, doc.email, 'DOCTOR', '9840012345', 'Female', '1984-06-20', 'Medical Enclave, Erode', 'English');
    const [existingDoc] = await db.query('SELECT id FROM doctors WHERE user_id = ?', [userId]);
    let docId;
    if (existingDoc.length > 0) {
      docId = existingDoc[0].id;
      await db.query(
        'UPDATE doctors SET specialization = ?, experience = ?, qualification = ?, start_time = ?, end_time = ?, consultation_fee = ?, bio = ? WHERE id = ?',
        [doc.spec, doc.exp, doc.qual, doc.start, doc.end, doc.fee, doc.bio, docId]
      );
    } else {
      const [res] = await db.query(
        'INSERT INTO doctors (user_id, specialization, experience, qualification, start_time, end_time, consultation_fee, bio) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, doc.spec, doc.exp, doc.qual, doc.start, doc.end, doc.fee, doc.bio]
      );
      docId = res.insertId;
    }
    doctorMap[doc.email] = { userId, docId };
  }

  // 5. Create Health Workers
  const hwList = [
    {
      name: 'Sarala Devi',
      email: 'hw1@demo.com',
      phone: '9842109876',
      area: 'Zone A - Perundurai Rural',
      empId: 'HW-101',
      qual: 'Certified Auxiliary Nurse Midwife (ANM)'
    },
    {
      name: 'Malathi R',
      email: 'hw2@demo.com',
      phone: '9842109877',
      area: 'Zone B - Bhavani Sector',
      empId: 'HW-102',
      qual: 'Senior ASHA Facilitator'
    }
  ];

  const hwMap = {};
  for (const hw of hwList) {
    const userId = await upsertUser(hw.name, hw.email, 'HEALTH_WORKER', hw.phone, 'Female', '1990-03-15', hw.area, 'Tamil');
    const [existingHw] = await db.query('SELECT id FROM health_workers WHERE user_id = ?', [userId]);
    let hwId;
    if (existingHw.length > 0) {
      hwId = existingHw[0].id;
      await db.query('UPDATE health_workers SET assigned_area = ?, employee_id = ?, qualification = ? WHERE id = ?',
        [hw.area, hw.empId, hw.qual, hwId]);
    } else {
      const [res] = await db.query('INSERT INTO health_workers (user_id, assigned_area, employee_id, qualification) VALUES (?, ?, ?, ?)',
        [userId, hw.area, hw.empId, hw.qual]);
      hwId = res.insertId;
    }
    hwMap[hw.email] = { userId, hwId };
  }

  // 6. Create Patients
  const patientsList = [
    {
      name: 'Rajesh Kumar',
      email: 'patient1@demo.com',
      phone: '9840123451',
      gender: 'Male',
      dob: '1985-04-12',
      address: '14 Gandhi Road, Erode',
      language: 'Tamil',
      emgName: 'Sita Kumar (Wife)',
      emgPhone: '9840123459'
    },
    {
      name: 'Ananya Sharma',
      email: 'patient2@demo.com',
      phone: '9840123452',
      gender: 'Female',
      dob: '1992-09-21',
      address: '22 Cherry Lane, Perundurai',
      language: 'English',
      emgName: 'Ramesh Sharma (Father)',
      emgPhone: '9840123458'
    },
    {
      name: 'Kavita Patel',
      email: 'patient3@demo.com',
      phone: '9840123453',
      gender: 'Female',
      dob: '1978-11-05',
      address: '78 Kongu Nagar, Erode',
      language: 'Tamil',
      emgName: 'Vikram Patel (Husband)',
      emgPhone: '9840123457'
    },
    {
      name: 'Suresh Babu',
      email: 'patient4@demo.com',
      phone: '9840123454',
      gender: 'Male',
      dob: '1965-02-18',
      address: '5 Bhavani Main Road, Bhavani',
      language: 'Tamil',
      emgName: 'Deepa Babu (Daughter)',
      emgPhone: '9840123456'
    },
    {
      name: 'Deepak V',
      email: 'patient5@demo.com',
      phone: '9840123455',
      gender: 'Male',
      dob: '2001-07-30',
      address: '102 Brough Road, Erode',
      language: 'English',
      emgName: 'Vasanth (Father)',
      emgPhone: '9840123450'
    }
  ];

  const patientMap = {};
  for (const p of patientsList) {
    const userId = await upsertUser(p.name, p.email, 'PATIENT', p.phone, p.gender, p.dob, p.address, p.language);
    await db.query('UPDATE users SET emergency_contact_name = ?, emergency_contact_phone = ? WHERE id = ?',
      [p.emgName, p.emgPhone, userId]);
    patientMap[p.email] = userId;
  }

  // 7. Assign Patients to Health Worker 1
  const hw1Id = hwMap['hw1@demo.com'].hwId;
  const hw2Id = hwMap['hw2@demo.com'].hwId;

  for (const pEmail of ['patient1@demo.com', 'patient2@demo.com', 'patient3@demo.com']) {
    const pId = patientMap[pEmail];
    await db.query(
      'INSERT IGNORE INTO health_worker_patients (health_worker_id, patient_id, notes) VALUES (?, ?, ?)',
      [hw1Id, pId, 'Regular community health follow-up assigned']
    );
  }

  for (const pEmail of ['patient4@demo.com', 'patient5@demo.com']) {
    const pId = patientMap[pEmail];
    await db.query(
      'INSERT IGNORE INTO health_worker_patients (health_worker_id, patient_id, notes) VALUES (?, ?, ?)',
      [hw2Id, pId, 'Senior citizen and adolescent health monitoring']
    );
  }

  // 8. Medicines master catalog
  const meds = [
    ['Paracetamol 500mg', 'Analgesic & Antipyretic', 'Reduces fever and relieves mild to moderate pain', 'Tablet'],
    ['Amoxicillin 500mg', 'Antibiotic', 'Treats bacterial infections of ear, nose, throat and chest', 'Capsule'],
    ['Cetirizine 10mg', 'Antihistamine', 'Relieves allergy symptoms like sneezing, runny nose, and hives', 'Tablet'],
    ['Metformin 500mg', 'Antidiabetic', 'Lowers blood glucose levels in Type 2 Diabetes', 'Tablet'],
    ['ORS Sachet', 'Electrolyte Rehydration', 'Treats and prevents dehydration caused by diarrhea or fever', 'Powder'],
    ['Pantoprazole 40mg', 'Antacid / PPI', 'Reduces stomach acid, treats acid reflux and gastritis', 'Tablet'],
    ['Atorvastatin 10mg', 'Lipid-lowering', 'Controls cholesterol levels and reduces cardiovascular risk', 'Tablet'],
    ['Amlodipine 5mg', 'Antihypertensive', 'Lowers high blood pressure and prevents chest pain (angina)', 'Tablet']
  ];

  const medMap = {};
  for (const [name, cat, desc, form] of meds) {
    await db.query(
      'INSERT INTO medicines (name, category, description, dosage_form) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE category = VALUES(category), description = VALUES(description)',
      [name, cat, desc, form]
    );
    const [row] = await db.query('SELECT id FROM medicines WHERE name = ?', [name]);
    medMap[name] = row[0].id;
  }

  // 9. Hospitals Directory
  const hospitals = [
    ['Erode Government General Hospital', 'Perundurai Rd, Erode, TN 638011', '0424-2255000', 'Emergency, Trauma ICU, General Medicine, Surgery, Maternity', 1, 11.3410, 77.7172],
    ['Kongu Care Multi-Speciality Clinic', 'Brough Rd, Erode, TN 638001', '0424-2200111', 'General Medicine, Pediatrics, Diabetes Care, Pharmacy', 0, 11.3500, 77.7270],
    ['Sri Lakshmi Heart & Trauma Hospital', 'Bhavani Rd, Erode, TN 638004', '0424-2260222', 'Cardiology, Cath Lab, 24/7 Emergency, Ambulance', 1, 11.3300, 77.7000],
    ['Apollo Speciality Hospital', 'Near Bus Stand, Erode, TN 638002', '0424-2289900', 'Cardiology, Neurology, Oncology, Emergency Care', 1, 11.3550, 77.7120],
    ['Lotus Family Health Center', 'Sathy Road, Erode, TN 638003', '0424-2241234', 'Family Practice, Preventive Checkups, Diagnostic Lab', 0, 11.3620, 77.7310]
  ];

  for (const h of hospitals) {
    const [existing] = await db.query('SELECT id FROM hospitals WHERE name = ?', [h[0]]);
    if (existing.length === 0) {
      await db.query('INSERT INTO hospitals (name, address, phone, services, emergency, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?)', h);
    }
  }

  // 10. Sample Appointments
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const p1 = patientMap['patient1@demo.com'];
  const p2 = patientMap['patient2@demo.com'];
  const docPriya = doctorMap['priya@demo.com'].docId;
  const docArun = doctorMap['arun@demo.com'].docId;

  // Insert appointments
  const sampleAppointments = [
    { pId: p1, dId: docPriya, date: tomorrow, time: '10:30:00', reason: 'Routine hypertension follow-up & chest tightness check', status: 'Confirmed' },
    { pId: p1, dId: docArun, date: yesterday, time: '11:00:00', reason: 'Fever and throat irritation consultation', status: 'Completed' },
    { pId: p2, dId: docArun, date: tomorrow, time: '14:00:00', reason: 'Blood sugar check and dietary advice', status: 'Pending' }
  ];

  for (const apt of sampleAppointments) {
    await db.query(
      'INSERT IGNORE INTO appointments (patient_id, doctor_id, date, time, reason, status) VALUES (?, ?, ?, ?, ?, ?)',
      [apt.pId, apt.dId, apt.date, apt.time, apt.reason, apt.status]
    );
  }

  // 11. Sample Consultation Messages
  const [aptRows] = await db.query('SELECT id, patient_id, doctor_id FROM appointments WHERE status = "Confirmed" LIMIT 1');
  if (aptRows.length > 0) {
    const apt = aptRows[0];
    const [docUser] = await db.query('SELECT user_id FROM doctors WHERE id = ?', [apt.doctor_id]);
    const dUserId = docUser[0].user_id;

    const [existingMsg] = await db.query('SELECT id FROM consultation_messages WHERE appointment_id = ?', [apt.id]);
    if (existingMsg.length === 0) {
      await db.query('INSERT INTO consultation_messages (appointment_id, sender_id, text, language) VALUES (?, ?, ?, ?)',
        [apt.id, dUserId, 'Hello Rajesh, how are you feeling today? Has the blood pressure stayed in normal limits?', 'English']);
      await db.query('INSERT INTO consultation_messages (appointment_id, sender_id, text, language) VALUES (?, ?, ?, ?)',
        [apt.id, apt.patient_id, 'Good morning Doctor. Yes, morning reading was 128/82. Mild headache in the evening yesterday.', 'English']);
    }
  }

  // 12. Sample Prescription & Reminders
  const [compApt] = await db.query('SELECT id, patient_id, doctor_id FROM appointments WHERE status = "Completed" LIMIT 1');
  if (compApt.length > 0) {
    const ca = compApt[0];
    const [rxRows] = await db.query('SELECT id FROM prescriptions WHERE patient_id = ?', [ca.patient_id]);
    let rxId;
    if (rxRows.length === 0) {
      const [newRx] = await db.query(
        'INSERT INTO prescriptions (appointment_id, patient_id, doctor_id, diagnosis, notes) VALUES (?, ?, ?, ?, ?)',
        [ca.id, ca.patient_id, ca.doctor_id, 'Upper Respiratory Infection / Mild Pyrexia', 'Patient advised to take plenty of warm fluids and complete the 5-day antibiotic course. Review if fever persists.']
      );
      rxId = newRx.insertId;

      // Add prescription items
      const paraId = medMap['Paracetamol 500mg'];
      const amoxId = medMap['Amoxicillin 500mg'];

      const [it1] = await db.query(
        'INSERT INTO prescription_items (prescription_id, medicine_id, dosage, frequency, days, instructions, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 5 DAY))',
        [rxId, paraId, '500 mg', 2, 5, 'Take 1 tablet after meals when having fever']
      );

      const [it2] = await db.query(
        'INSERT INTO prescription_items (prescription_id, medicine_id, dosage, frequency, days, instructions, start_date, end_date) VALUES (?, ?, ?, ?, ?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 5 DAY))',
        [rxId, amoxId, '500 mg', 2, 5, 'Take 1 capsule twice daily after meals']
      );

      // Create reminders for Rajesh
      for (const t of ['09:00:00', '21:00:00']) {
        await db.query('INSERT INTO medicine_reminders (patient_id, item_id, remind_time, status) VALUES (?, ?, ?, "Active")',
          [ca.patient_id, it1.insertId, t]);
        await db.query('INSERT INTO medicine_reminders (patient_id, item_id, remind_time, status) VALUES (?, ?, ?, "Active")',
          [ca.patient_id, it2.insertId, t]);
      }
    }
  }

  // 13. Sample Home Visit & Follow-up for Health Worker
  const [existingVisits] = await db.query('SELECT id FROM home_visits WHERE health_worker_id = ?', [hw1Id]);
  if (existingVisits.length === 0) {
    await db.query(
      'INSERT INTO home_visits (health_worker_id, patient_id, visit_date, blood_pressure, pulse, blood_sugar, temperature, observations, next_followup_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        hw1Id,
        p1,
        yesterday,
        '130/84 mmHg',
        '74 bpm',
        '112 mg/dL',
        '98.4°F',
        'Patient reports steady improvement. Compliant with morning medications. Advised to reduce sodium intake and maintain daily hydration.',
        tomorrow
      ]
    );

    await db.query(
      'INSERT INTO patient_followups (health_worker_id, patient_id, observation, adherence_notes) VALUES (?, ?, ?, ?)',
      [
        hw1Id,
        p1,
        'Checked medication blister packs. All morning doses taken on time.',
        'Good compliance. Encouraged walking 20 minutes each morning.'
      ]
    );
  }

  // 14. Sample Notifications
  await db.query('INSERT INTO notifications (user_id, message) VALUES (?, ?)',
    [p1, 'Your appointment with Dr. Priya Sharma has been confirmed for tomorrow at 10:30 AM.']);
  await db.query('INSERT INTO notifications (user_id, message) VALUES (?, ?)',
    [p1, 'Medicine Reminder: Please take Paracetamol 500mg after breakfast.']);

  // 15. Sample Medical Reports & Report Sharing (Safe synthetic demo data)
  const reportsDir = path.join(__dirname, 'uploads', 'medical_reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const sampleFileName = 'demo_blood_test_report.pdf';
  const sampleFilePath = path.join(reportsDir, sampleFileName);
  if (!fs.existsSync(sampleFilePath)) {
    // Generate a minimal valid PDF demo artifact
    const dummyPdfContent = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 75 >>\nstream\nBT /F1 14 Tf 50 700 Td (MediConnect AI - Synthetic Demo Medical Report) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000206 00000 n \ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n332\n%%EOF`;
    fs.writeFileSync(sampleFilePath, dummyPdfContent);
  }

  const [existingReports] = await db.query('SELECT id FROM medical_reports WHERE patient_id = ?', [p1]);
  if (existingReports.length === 0) {
    const [insertedRep] = await db.query(`
      INSERT INTO medical_reports 
      (patient_id, title, category, description, report_date, original_file_name, stored_file_name, file_path, file_type, file_size, uploaded_by_user_id, allow_health_worker_access)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      p1,
      'Complete Blood Count (CBC) & Lipid Profile',
      'Blood Test',
      'Routine fasting blood work showing normal hemoglobin and slight elevated LDL cholesterol.',
      today,
      'CBC_Lipid_Report.pdf',
      sampleFileName,
      sampleFilePath,
      'application/pdf',
      350,
      p1,
      true
    ]);

    const reportId = insertedRep.insertId;

    // Share report with Dr. Priya Sharma
    await db.query(`
      INSERT IGNORE INTO medical_report_shares (report_id, shared_with_doctor_id, shared_by_user_id, notes)
      VALUES (?, ?, ?, ?)
    `, [reportId, docPriya, p1, 'Shared for upcoming cardiology appointment']);

    // Doctor clinical note
    await db.query(`
      INSERT INTO medical_report_clinical_notes (report_id, doctor_id, notes)
      VALUES (?, ?, ?)
    `, [reportId, docPriya, 'Lipid profile reviewed. LDL borderline 132 mg/dL. Recommended dietary adjustments and 30 mins cardio daily.']);
  }

  console.log('🎉 Seeding successfully completed!');
  console.log('----------------------------------------------------');
  console.log('DEMO ACCOUNTS READY (Password for all: Password@123):');
  console.log('👑 Admin:          admin@demo.com');
  console.log('🩺 Doctors:        priya@demo.com, arun@demo.com, meena@demo.com');
  console.log('📋 Health Workers: hw1@demo.com (Sarala), hw2@demo.com (Malathi)');
  console.log('🧑 Patients:        patient1@demo.com to patient5@demo.com');
  console.log('----------------------------------------------------');
  process.exit(0);
}

initAndSeed().catch(err => {
  console.error('❌ Error during init and seed:', err);
  process.exit(1);
});
