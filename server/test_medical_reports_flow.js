const BASE = 'http://localhost:5000/api';

async function req(path, method = 'GET', body = null, token = null, isFormData = false) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!isFormData && body && typeof body === 'object') {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: isFormData ? body : (body ? JSON.stringify(body) : undefined)
  });

  const contentType = res.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await res.json().catch(() => ({}));
  } else {
    data = await res.arrayBuffer();
  }

  return { status: res.status, ok: res.ok, headers: res.headers, data };
}

async function runMedicalReportVerification() {
  console.log('================================================================');
  console.log('🩺 MediConnect AI — Medical Report Upload & Sharing System Flow');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(title, condition, details = '') {
    total++;
    if (condition) {
      console.log(`   ✅ PASS: ${title} ${details ? `(${details})` : ''}`);
      passed++;
    } else {
      console.error(`   ❌ FAIL: ${title} ${details ? `(${details})` : ''}`);
    }
  }

  try {
    // -------------------------------------------------------------
    // 1. PATIENT AUTHENTICATION & INITIAL DASHBOARD CHECK
    // -------------------------------------------------------------
    console.log('1️⃣ Authenticating Patient & Loading Dashboard...');
    const pLogin = await req('/auth/login', 'POST', {
      email: 'patient1@demo.com',
      password: 'Password@123',
      expected_role: 'PATIENT'
    });
    assert('Patient login (patient1@demo.com)', pLogin.ok, `Status: ${pLogin.status}`);
    const patientToken = pLogin.data.token;
    const patientUser = pLogin.data.user;
    console.log(`      User: ${patientUser.name} | Role: ${patientUser.role} | ID: #${patientUser.id}`);

    // Check initial patient reports
    const initReports = await req('/medical-reports', 'GET', null, patientToken);
    const reportsList = Array.isArray(initReports.data) ? initReports.data : [];
    assert('Fetch patient reports from MySQL', initReports.ok, `Found: ${reportsList.length}`);

    // -------------------------------------------------------------
    // 2. VALIDATION OF FILE FORMATS & FILE SIZE LIMITS
    // -------------------------------------------------------------
    console.log('\n2️⃣ Testing Validation for Invalid File Types & Oversized Files...');

    // Invalid file type (.txt)
    const invalidForm = new FormData();
    invalidForm.append('title', 'Invalid Format Test');
    invalidForm.append('category', 'Lab Report');
    invalidForm.append('report_date', '2026-10-27');
    invalidForm.append('report_file', new Blob(['Sample invalid text'], { type: 'text/plain' }), 'test.txt');

    const invalidRes = await req('/medical-reports', 'POST', invalidForm, patientToken, true);
    assert('Reject invalid .txt file extension', invalidRes.status === 400, `Got HTTP ${invalidRes.status}: ${invalidRes.data?.error}`);

    // Oversized file (>15MB)
    const hugeForm = new FormData();
    hugeForm.append('title', 'Oversized File Test');
    hugeForm.append('category', 'Scan/X-ray');
    hugeForm.append('report_date', '2026-10-27');
    const largeBuffer = new Uint8Array(16 * 1024 * 1024); // 16MB
    hugeForm.append('report_file', new Blob([largeBuffer], { type: 'application/pdf' }), 'huge_scan.pdf');

    const hugeRes = await req('/medical-reports', 'POST', hugeForm, patientToken, true);
    assert('Reject file exceeding 15MB limit', hugeRes.status === 400, `Got HTTP ${hugeRes.status}: ${hugeRes.data?.error}`);

    // Missing title validation
    const noTitleForm = new FormData();
    noTitleForm.append('category', 'Blood Test');
    noTitleForm.append('report_file', new Blob(['%PDF-1.5 test'], { type: 'application/pdf' }), 'notitle.pdf');
    const noTitleRes = await req('/medical-reports', 'POST', noTitleForm, patientToken, true);
    assert('Reject report with missing title', noTitleRes.status === 400, `Got HTTP ${noTitleRes.status}: ${noTitleRes.data?.error}`);

    // -------------------------------------------------------------
    // 3. PATIENT UPLOADS VALID MEDICAL REPORTS (PDF & IMAGE)
    // -------------------------------------------------------------
    console.log('\n3️⃣ Patient Uploads Valid Medical Reports (PDF & PNG)...');

    // Upload PDF Report
    const pdfForm = new FormData();
    pdfForm.append('title', 'Complete Blood Count & Lipid Profile');
    pdfForm.append('category', 'Blood Test');
    pdfForm.append('report_date', '2026-10-27');
    pdfForm.append('description', 'Fasting blood glucose 98 mg/dL, Total Cholesterol 185 mg/dL');
    const fakePdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x35, 0x0A, 0x25, 0xD0, 0xD4, 0xC5, 0xD8]);
    pdfForm.append('report_file', new Blob([fakePdf], { type: 'application/pdf' }), 'cbc_blood_test.pdf');

    const pdfUploadRes = await req('/medical-reports', 'POST', pdfForm, patientToken, true);
    assert('Patient uploads PDF report', pdfUploadRes.status === 201, `Status: ${pdfUploadRes.status}`);
    const pdfReportId = pdfUploadRes.data?.reportId;
    console.log(`      Report ID: #${pdfReportId} | Message: "${pdfUploadRes.data?.message}"`);

    // Upload Image Report (PNG)
    const imgForm = new FormData();
    imgForm.append('title', 'Chest X-Ray PA View');
    imgForm.append('category', 'Scan/X-ray');
    imgForm.append('report_date', '2026-10-26');
    imgForm.append('description', 'Normal lung parenchyma and cardiac silhouette');
    const fakePng = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
    imgForm.append('report_file', new Blob([fakePng], { type: 'image/png' }), 'chest_xray.png');

    const imgUploadRes = await req('/medical-reports', 'POST', imgForm, patientToken, true);
    assert('Patient uploads Scan/X-ray image report', imgUploadRes.status === 201, `Status: ${imgUploadRes.status}`);
    const imgReportId = imgUploadRes.data?.reportId;
    console.log(`      Report ID: #${imgReportId} | Message: "${imgUploadRes.data?.message}"`);

    // -------------------------------------------------------------
    // 4. PERSISTENCE ACROSS SESSIONS & DASHBOARD RETRIEVAL
    // -------------------------------------------------------------
    console.log('\n4️⃣ Verifying Persistence across Refresh & Session Re-login...');
    const reLogin = await req('/auth/login', 'POST', {
      email: 'patient1@demo.com',
      password: 'Password@123',
      expected_role: 'PATIENT'
    });
    const refreshedToken = reLogin.data.token;
    const listRes = await req('/medical-reports', 'GET', null, refreshedToken);
    assert('Retrieve reports list after re-authentication', listRes.ok);

    const reportsArray = Array.isArray(listRes.data) ? listRes.data : [];
    const hasPdf = reportsArray.some(r => r.id === pdfReportId);
    const hasImg = reportsArray.some(r => r.id === imgReportId);
    assert('Uploaded PDF report persisted in MySQL', hasPdf);
    assert('Uploaded Image report persisted in MySQL', hasImg);

    // -------------------------------------------------------------
    // 5. AUTHENTICATED PREVIEW & SECURE DOWNLOAD
    // -------------------------------------------------------------
    console.log('\n5️⃣ Testing Authenticated Preview & Secure Download...');
    const previewRes = await req(`/medical-reports/${pdfReportId}/preview`, 'GET', null, patientToken);
    assert('Preview PDF document inline stream', previewRes.status === 200, `Content-Type: ${previewRes.headers.get('content-type')}`);

    const downloadRes = await req(`/medical-reports/${pdfReportId}/download`, 'GET', null, patientToken);
    assert('Download PDF report attachment', downloadRes.status === 200, `Content-Disposition: ${downloadRes.headers.get('content-disposition')}`);

    // -------------------------------------------------------------
    // 6. DOCTOR ACCESS CONTROL & REPORT SHARING
    // -------------------------------------------------------------
    console.log('\n6️⃣ Testing Doctor Privacy, Authorization & Report Sharing...');
    // Doctor login (Dr. Priya)
    const dLogin = await req('/auth/login', 'POST', {
      email: 'priya@demo.com',
      password: 'Password@123',
      expected_role: 'DOCTOR'
    });
    const docToken = dLogin.data.token;
    const docUser = dLogin.data.user;

    // Doctor checks shared reports before sharing -> Should NOT see unshared report
    const docReportsBefore = await req('/medical-reports', 'GET', null, docToken);
    const docReportsArrayBefore = Array.isArray(docReportsBefore.data) ? docReportsBefore.data : [];
    const seesBeforeSharing = docReportsArrayBefore.some(r => r.id === pdfReportId);
    assert('Doctor cannot see report before patient shares it', !seesBeforeSharing);

    // Unauthorized direct access before sharing -> 403 Forbidden
    const unsharedAccess = await req(`/medical-reports/${pdfReportId}/preview`, 'GET', null, docToken);
    assert('Doctor direct access before sharing rejected with 403 Forbidden', unsharedAccess.status === 403);

    // Get Dr. Priya's doctor profile ID
    const meRes = await req('/auth/me', 'GET', null, docToken);
    const doctorProfileId = meRes.data.doctorInfo?.id;

    // Patient explicitly shares the PDF report with Dr. Priya
    console.log(`   📤 Patient shares Report #${pdfReportId} with Dr. Priya (Doctor ID #${doctorProfileId})...`);
    const shareRes = await req(`/medical-reports/${pdfReportId}/share`, 'POST', {
      doctor_id: doctorProfileId,
      notes: 'Please review before our upcoming cardiac review appointment'
    }, patientToken);
    assert('Patient shares report with Doctor', shareRes.status === 200);

    // Doctor now sees report in shared reports list
    const docReportsAfter = await req('/medical-reports', 'GET', null, docToken);
    const docReportsArrayAfter = Array.isArray(docReportsAfter.data) ? docReportsAfter.data : [];
    const seesAfterSharing = docReportsArrayAfter.some(r => r.id === pdfReportId);
    assert('Doctor now receives shared report in dashboard list', seesAfterSharing);

    // Doctor previews authorized report
    const docPreview = await req(`/medical-reports/${pdfReportId}/preview`, 'GET', null, docToken);
    assert('Authorized doctor can preview shared report', docPreview.status === 200);

    // Doctor adds clinical observation note
    const noteRes = await req(`/medical-reports/${pdfReportId}/notes`, 'POST', {
      notes: 'Fasting lipid levels are within optimal range. Continue regular aerobic exercise.'
    }, docToken);
    assert('Doctor records clinical observation note', noteRes.status === 201);

    // -------------------------------------------------------------
    // 7. HEALTH WORKER ASSISTED UPLOAD & ACCESS CONTROL
    // -------------------------------------------------------------
    console.log('\n7️⃣ Testing Health Worker Dashboard & Assisted Upload...');
    const hwLogin = await req('/auth/login', 'POST', {
      email: 'hw1@demo.com',
      password: 'Password@123',
      expected_role: 'HEALTH_WORKER'
    });
    const hwToken = hwLogin.data.token;
    const hwUser = hwLogin.data.user;

    // Fetch assigned patients
    const hwPatients = await req('/health-worker/patients', 'GET', null, hwToken);
    const assignedPatient = hwPatients.data?.[0];
    assert('Health worker retrieves assigned community patients', !!assignedPatient, `Patient ID #${assignedPatient?.id}`);

    if (assignedPatient) {
      // Health worker assists patient by uploading report on their behalf
      const hwUploadForm = new FormData();
      hwUploadForm.append('patient_id', assignedPatient.id);
      hwUploadForm.append('title', 'Rural Health Camp Vitals & ECG');
      hwUploadForm.append('category', 'Discharge Summary');
      hwUploadForm.append('report_date', '2026-10-27');
      hwUploadForm.append('description', 'Conducted during community health screening camp');
      hwUploadForm.append('report_file', new Blob([fakePdf], { type: 'application/pdf' }), 'rural_ecg_summary.pdf');

      const hwUploadRes = await req('/medical-reports', 'POST', hwUploadForm, hwToken, true);
      assert('Health worker uploads report on behalf of assigned patient', hwUploadRes.status === 201);
    }

    // -------------------------------------------------------------
    // 8. REVOKE SHARING & AUDIT VERIFICATION
    // -------------------------------------------------------------
    console.log('\n8️⃣ Testing Access Revocation...');
    const reportDetails = await req(`/medical-reports/${pdfReportId}`, 'GET', null, patientToken);
    const shareId = reportDetails.data.shares?.[0]?.id;

    if (shareId) {
      const revokeRes = await req(`/medical-reports/${pdfReportId}/share/${shareId}`, 'DELETE', null, patientToken);
      assert('Patient successfully revokes doctor access', revokeRes.status === 200);

      // Verify doctor can no longer access after revocation
      const docAccessRevoked = await req(`/medical-reports/${pdfReportId}/preview`, 'GET', null, docToken);
      assert('Doctor access denied after share revocation (403 Forbidden)', docAccessRevoked.status === 403);
    }

    // -------------------------------------------------------------
    // FINAL SUMMARY
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`🎯 Test Summary: ${passed} Passed out of ${total} Total Tests (${Math.round((passed / total) * 100)}%)`);
    console.log('================================================================\n');

    if (passed === total) {
      console.log('🎉 ALL MEDICAL REPORT UPLOAD & SHARING REQUIREMENTS VERIFIED SUCCESSFULLY!');
    } else {
      console.error('⚠️ Some tests failed. Please check the logs above.');
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Unexpected Error during verification:', err);
    process.exit(1);
  }
}

runMedicalReportVerification();
