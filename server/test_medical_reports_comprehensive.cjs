const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000';

function request(options, postData = null, isMultipart = false, boundary = '') {
  return new Promise((resolve, reject) => {
    const url = new URL(options.url, BASE_URL);
    const reqOptions = {
      method: options.method || 'GET',
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { ...(options.headers || {}) }
    };

    if (isMultipart) {
      reqOptions.headers['Content-Type'] = `multipart/form-data; boundary=${boundary}`;
      reqOptions.headers['Content-Length'] = Buffer.isBuffer(postData) ? postData.length : Buffer.byteLength(postData);
    } else if (postData && typeof postData === 'object' && !Buffer.isBuffer(postData)) {
      postData = JSON.stringify(postData);
      reqOptions.headers['Content-Type'] = 'application/json';
      reqOptions.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks);
        let data = null;
        try {
          data = JSON.parse(raw.toString());
        } catch (e) {
          data = raw;
        }
        resolve({ status: res.statusCode, headers: res.headers, data, raw });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function buildMultipart(fields, fileField) {
  const boundary = '----WebKitFormBoundary' + Math.random().toString(36).substring(2);
  const parts = [];

  for (const [k, v] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  }

  if (fileField) {
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${fileField.name}"; filename="${fileField.filename}"\r\nContent-Type: ${fileField.contentType}\r\n\r\n`
    ));
    parts.push(fileField.content);
    parts.push(Buffer.from('\r\n'));
  }

  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return { buffer: Buffer.concat(parts), boundary };
}

async function runTests() {
  console.log('===============================================================');
  console.log('🧪 MediConnect AI — Comprehensive Medical Reports Test Suite');
  console.log('===============================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(desc, condition, details = '') {
    if (condition) {
      console.log(`✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${desc} ${details ? `(${details})` : ''}`);
      failed++;
    }
  }

  // 1. Authenticate users
  console.log('--- Step 1: Authentication for Roles ---');
  // Patient
  const pRes = await request({ url: '/api/auth/login', method: 'POST' }, { email: 'patient1@demo.com', password: 'Password@123' });
  const patientToken = pRes.data?.token;
  const patientUser = pRes.data?.user;
  assert('Patient login (patient1@demo.com)', !!patientToken, `Status: ${pRes.status}`);

  // Doctor 1 (Dr. Priya)
  const d1Res = await request({ url: '/api/auth/login', method: 'POST' }, { email: 'priya@demo.com', password: 'Password@123' });
  const doc1Token = d1Res.data?.token;
  const doc1User = d1Res.data?.user;
  assert('Doctor 1 login (priya@demo.com)', !!doc1Token, `Status: ${d1Res.status}`);

  // Health Worker (Lakshmi)
  const hwRes = await request({ url: '/api/auth/login', method: 'POST' }, { email: 'hw1@demo.com', password: 'Password@123' });
  const hwToken = hwRes.data?.token;
  const hwUser = hwRes.data?.user;
  assert('Health Worker login (hw1@demo.com)', !!hwToken, `Status: ${hwRes.status}`);

  // Get Doctors list
  const docListRes = await request({ url: '/api/doctors', headers: { Authorization: `Bearer ${patientToken}` } });
  const doc1Record = (docListRes.data || []).find(d => d.user_id === doc1User?.id) || docListRes.data?.[0];
  const doc2Record = (docListRes.data || []).find(d => d.id !== doc1Record?.id);
  assert('Retrieved Doctor 1 record', !!doc1Record);

  // Doctor 2 login (find user from doctors list if available)
  let doc2Token = null;
  let doc2User = null;
  if (doc2Record) {
    const d2Login = await request({ url: '/api/auth/login', method: 'POST' }, { email: doc2Record.email || 'rajesh@demo.com', password: 'Password@123' });
    doc2Token = d2Login.data?.token;
    doc2User = d2Login.data?.user;
  }

  // 2. Test File Format & Size Validation
  console.log('\n--- Step 2: Validation of Unsupported File Types & Max File Size ---');
  // Unsupported file type (.txt)
  const txtFile = {
    name: 'report_file',
    filename: 'fake_report.txt',
    contentType: 'text/plain',
    content: Buffer.from('Hello world test text')
  };
  const { buffer: txtBuf, boundary: txtBound } = buildMultipart({ title: 'Invalid Txt Report', category: 'General' }, txtFile);
  const badExtRes = await request({
    url: '/api/medical-reports',
    method: 'POST',
    headers: { Authorization: `Bearer ${patientToken}` }
  }, txtBuf, true, txtBound);
  assert('Unsupported file type (.txt) rejected safely with 400', badExtRes.status === 400);

  // Oversized file (> 15MB)
  const bigBuffer = Buffer.alloc(16 * 1024 * 1024); // 16MB
  const bigFile = {
    name: 'report_file',
    filename: 'giant_scan.pdf',
    contentType: 'application/pdf',
    content: bigBuffer
  };
  const { buffer: bigBuf, boundary: bigBound } = buildMultipart({ title: 'Giant Scan', category: 'X-Ray / Scan' }, bigFile);
  const bigRes = await request({
    url: '/api/medical-reports',
    method: 'POST',
    headers: { Authorization: `Bearer ${patientToken}` }
  }, bigBuf, true, bigBound);
  assert('Oversized file (>15MB) rejected safely with 400', bigRes.status === 400);

  // Missing Title
  const dummyPdf = {
    name: 'report_file',
    filename: 'blood_test_cbc.pdf',
    contentType: 'application/pdf',
    content: Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Title (CBC Report)\n>>\nendobj\ntrailer\n<<\n>>\n%%EOF')
  };
  const { buffer: noTitleBuf, boundary: noTitleBound } = buildMultipart({ title: '', category: 'Blood Test Report' }, dummyPdf);
  const noTitleRes = await request({
    url: '/api/medical-reports',
    method: 'POST',
    headers: { Authorization: `Bearer ${patientToken}` }
  }, noTitleBuf, true, noTitleBound);
  assert('Missing title rejected with 400', noTitleRes.status === 400);

  // 3. Patient Uploads PDF Report (Complete Blood Count)
  console.log('\n--- Step 3: Patient Uploads PDF Report ---');
  const pdfFile = {
    name: 'report_file',
    filename: 'complete_blood_count.pdf',
    contentType: 'application/pdf',
    content: Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Title (Complete Blood Count)\n/Author (City Diagnostic Lab)\n>>\nendobj\ntrailer\n<<\n>>\n%%EOF')
  };
  const { buffer: pdfBuf, boundary: pdfBound } = buildMultipart({
    title: 'Complete Blood Count (CBC) Analysis',
    category: 'Blood Test Report',
    description: 'Fasting blood count test conducted at City Diagnostic Labs.',
    report_date: '2026-10-25',
    allow_health_worker_access: 'true'
  }, pdfFile);

  const uploadPdfRes = await request({
    url: '/api/medical-reports',
    method: 'POST',
    headers: { Authorization: `Bearer ${patientToken}` }
  }, pdfBuf, true, pdfBound);

  assert('PDF report uploaded successfully (HTTP 201)', uploadPdfRes.status === 201);
  const pdfReportId = uploadPdfRes.data?.reportId;
  assert('Report ID generated', !!pdfReportId, `ID: ${pdfReportId}`);

  // 4. Patient Uploads Image Report (Chest X-Ray)
  console.log('\n--- Step 4: Patient Uploads Image Report ---');
  // Minimal valid 1x1 PNG
  const pngBytes = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2d400000000049454e44ae426082', 'hex');
  const imgFile = {
    name: 'report_file',
    filename: 'chest_xray_scan.png',
    contentType: 'image/png',
    content: pngBytes
  };
  const { buffer: imgBuf, boundary: imgBound } = buildMultipart({
    title: 'PA Chest Radiograph (X-Ray)',
    category: 'X-Ray / Scan',
    description: 'Digital X-ray taken for seasonal cough evaluation.',
    report_date: '2026-10-26',
    allow_health_worker_access: 'true'
  }, imgFile);

  const uploadImgRes = await request({
    url: '/api/medical-reports',
    method: 'POST',
    headers: { Authorization: `Bearer ${patientToken}` }
  }, imgBuf, true, imgBound);

  assert('Image report uploaded successfully (HTTP 201)', uploadImgRes.status === 201);
  const imgReportId = uploadImgRes.data?.reportId;
  assert('Image Report ID generated', !!imgReportId, `ID: ${imgReportId}`);

  // 5. Patient views own reports list & persistence
  console.log('\n--- Step 5: Patient Reports Listing & Persistence ---');
  const listRes = await request({
    url: '/api/medical-reports',
    headers: { Authorization: `Bearer ${patientToken}` }
  });
  assert('Patient retrieves own reports list (HTTP 200)', listRes.status === 200);
  const pReports = listRes.data || [];
  const foundPdf = pReports.find(r => r.id === pdfReportId);
  const foundImg = pReports.find(r => r.id === imgReportId);
  assert('Uploaded PDF report is present in list', !!foundPdf && foundPdf.title === 'Complete Blood Count (CBC) Analysis');
  assert('Uploaded Image report is present in list', !!foundImg && foundImg.title === 'PA Chest Radiograph (X-Ray)');

  // 6. Patient Preview & Download Endpoints
  console.log('\n--- Step 6: Patient Preview and Download ---');
  const prevRes = await request({
    url: `/api/medical-reports/${pdfReportId}/preview`,
    headers: { Authorization: `Bearer ${patientToken}` }
  });
  assert('Patient can preview PDF report (HTTP 200, Content-Type: application/pdf)',
    prevRes.status === 200 && prevRes.headers['content-type'] === 'application/pdf');

  const dlRes = await request({
    url: `/api/medical-reports/${pdfReportId}/download`,
    headers: { Authorization: `Bearer ${patientToken}` }
  });
  assert('Patient can download PDF report (HTTP 200, Content-Disposition attachment)',
    dlRes.status === 200 && dlRes.headers['content-disposition']?.includes('attachment'));

  // 7. Security: Doctor 1 cannot see reports BEFORE sharing
  console.log('\n--- Step 7: Doctor Authorization & Privacy (Before Sharing) ---');
  const doc1PreShareList = await request({
    url: '/api/medical-reports',
    headers: { Authorization: `Bearer ${doc1Token}` }
  });
  const doc1CanSeeBefore = (doc1PreShareList.data || []).some(r => r.id === pdfReportId);
  assert('Doctor 1 does NOT see unshared PDF report in list', !doc1CanSeeBefore);

  const doc1PreSharePreview = await request({
    url: `/api/medical-reports/${pdfReportId}/preview`,
    headers: { Authorization: `Bearer ${doc1Token}` }
  });
  assert('Doctor 1 direct access before sharing is rejected (HTTP 403 Forbidden)', doc1PreSharePreview.status === 403);

  // 8. Patient Shares Report with Doctor 1
  console.log('\n--- Step 8: Patient Shares Report with Doctor 1 ---');
  const shareRes = await request({
    url: `/api/medical-reports/${pdfReportId}/share`,
    method: 'POST',
    headers: { Authorization: `Bearer ${patientToken}` }
  }, { doctor_id: doc1Record.id, notes: 'Please review prior to teleconsultation.' });
  assert('Patient shares PDF report with Doctor 1 (HTTP 200)', shareRes.status === 200);

  // 9. Doctor 1 can now view the shared report
  console.log('\n--- Step 9: Authorized Doctor Views Shared Report ---');
  const doc1PostShareList = await request({
    url: '/api/medical-reports',
    headers: { Authorization: `Bearer ${doc1Token}` }
  });
  const doc1CanSeeAfter = (doc1PostShareList.data || []).some(r => r.id === pdfReportId);
  assert('Doctor 1 now sees shared PDF report in patient reports list', doc1CanSeeAfter);

  const doc1PreviewRes = await request({
    url: `/api/medical-reports/${pdfReportId}/preview`,
    headers: { Authorization: `Bearer ${doc1Token}` }
  });
  assert('Doctor 1 can preview authorized report (HTTP 200)', doc1PreviewRes.status === 200);

  // 10. Security: Doctor 2 (Unauthorized) CANNOT view Doctor 1's shared report
  console.log('\n--- Step 10: Unauthorized Doctor Access Rejection (IDOR Test) ---');
  const doc2List = await request({
    url: '/api/medical-reports',
    headers: { Authorization: `Bearer ${doc2Token}` }
  });
  const doc2CanSee = (doc2List.data || []).some(r => r.id === pdfReportId);
  assert('Doctor 2 does NOT see report in their shared reports list', !doc2CanSee);

  const doc2PreviewRes = await request({
    url: `/api/medical-reports/${pdfReportId}/preview`,
    headers: { Authorization: `Bearer ${doc2Token}` }
  });
  assert('Doctor 2 preview attempt rejected with HTTP 403 Forbidden', doc2PreviewRes.status === 403);

  // 11. Doctor 1 Adds Clinical Observations & Notes
  console.log('\n--- Step 11: Doctor Adds Clinical Observations ---');
  const noteRes = await request({
    url: `/api/medical-reports/${pdfReportId}/notes`,
    method: 'POST',
    headers: { Authorization: `Bearer ${doc1Token}` }
  }, { notes: 'CBC shows mild anemia. Hemoglobin 10.8 g/dL. Recommend starting oral iron supplementation.' });
  assert('Doctor 1 adds clinical observation note (HTTP 201)', noteRes.status === 201);

  // Patient views report metadata and sees doctor's note
  const repDetailRes = await request({
    url: `/api/medical-reports/${pdfReportId}`,
    headers: { Authorization: `Bearer ${patientToken}` }
  });
  const hasNote = repDetailRes.data?.clinical_notes?.some(n => n.notes.includes('CBC shows mild anemia'));
  assert('Patient views report details and sees doctor clinical note', hasNote);

  // 12. Health Worker Access & Assisted Upload
  console.log('\n--- Step 12: Health Worker Role Integration ---');
  // Health worker views assigned patient's report
  const hwListRes = await request({
    url: '/api/medical-reports',
    headers: { Authorization: `Bearer ${hwToken}` }
  });
  const hwCanSee = (hwListRes.data || []).some(r => r.id === pdfReportId);
  assert('Assigned Health Worker can view authorized patient report', hwCanSee);

  // Health worker uploads a report on behalf of patient
  const hwDummyFile = {
    name: 'report_file',
    filename: 'rural_health_sugar.pdf',
    contentType: 'application/pdf',
    content: Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Title (Rural Camp Sugar Test)\n>>\nendobj\ntrailer\n<<\n>>\n%%EOF')
  };
  const { buffer: hwUploadBuf, boundary: hwUploadBound } = buildMultipart({
    patient_id: patientUser.id,
    title: 'Primary Health Centre Blood Glucose Test',
    category: 'Lab Test Report',
    description: 'Random blood sugar taken during village outreach camp.',
    report_date: '2026-10-27',
    allow_health_worker_access: 'true'
  }, hwDummyFile);

  const hwUploadRes = await request({
    url: '/api/medical-reports',
    method: 'POST',
    headers: { Authorization: `Bearer ${hwToken}` }
  }, hwUploadBuf, true, hwUploadBound);
  assert('Health Worker can upload report on behalf of assigned patient (HTTP 201)', hwUploadRes.status === 201);
  const hwUploadedReportId = hwUploadRes.data?.reportId;

  // 13. Teleconsultation Room Reports API
  console.log('\n--- Step 13: Teleconsultation Integration ---');
  // Find a confirmed appointment for this patient and doctor
  const aptsRes = await request({
    url: '/api/appointments',
    headers: { Authorization: `Bearer ${patientToken}` }
  });
  const aptRows = (aptsRes.data || []).filter(a => a.doctor_id === doc1Record.id);

  if (aptRows.length > 0) {
    const aptId = aptRows[0].id;
    const teleReportsDocRes = await request({
      url: `/api/consultations/${aptId}/reports`,
      headers: { Authorization: `Bearer ${doc1Token}` }
    });
    assert('Doctor teleconsultation room retrieves shared patient reports', teleReportsDocRes.status === 200 && teleReportsDocRes.data.length > 0);

    const teleReportsPatRes = await request({
      url: `/api/consultations/${aptId}/reports`,
      headers: { Authorization: `Bearer ${patientToken}` }
    });
    assert('Patient teleconsultation room retrieves reports', teleReportsPatRes.status === 200 && teleReportsPatRes.data.length > 0);
  } else {
    console.log('ℹ️ No active appointment found between patient and doc1 for teleconsult test; skipping query.');
  }

  // 14. Revoke Share & Delete Cleanup
  console.log('\n--- Step 14: Revoking Access & Report Deletion ---');
  // Get share ID
  const detail = await request({
    url: `/api/medical-reports/${pdfReportId}`,
    headers: { Authorization: `Bearer ${patientToken}` }
  });
  const shareItem = detail.data?.shares?.[0];
  if (shareItem) {
    const revokeRes = await request({
      url: `/api/medical-reports/${pdfReportId}/share/${shareItem.id}`,
      method: 'DELETE',
      headers: { Authorization: `Bearer ${patientToken}` }
    });
    assert('Patient successfully revokes doctor access (HTTP 200)', revokeRes.status === 200);

    // Verify Doctor 1 cannot access anymore
    const postRevokePreview = await request({
      url: `/api/medical-reports/${pdfReportId}/preview`,
      headers: { Authorization: `Bearer ${doc1Token}` }
    });
    assert('Doctor 1 is denied access after share is revoked (HTTP 403 Forbidden)', postRevokePreview.status === 403);
  }

  // Clean up test reports
  if (hwUploadedReportId) {
    await request({
      url: `/api/medical-reports/${hwUploadedReportId}`,
      method: 'DELETE',
      headers: { Authorization: `Bearer ${patientToken}` }
    });
  }

  console.log('\n===============================================================');
  console.log(`🎯 Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log('===============================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
