import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  FileText,
  Upload,
  Download,
  Share2,
  Eye,
  Trash2,
  Calendar,
  Clock,
  User,
  Users,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  XCircle,
  Search,
  Filter,
  PlusCircle,
  FileCheck,
  Edit3,
  Stethoscope,
  ShieldCheck,
  Video,
  Info,
  ExternalLink
} from 'lucide-react';

const apiBase = typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost'
  ? `http://${window.location.hostname}:5000/api`
  : 'http://localhost:5000/api';

const api = axios.create({ baseURL: apiBase });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Categories requested: Blood Test, Scan/X-ray, Prescription, Lab Report, Discharge Summary, Other
export const REPORT_CATEGORIES = [
  { id: 'Blood Test', label: 'Blood Test', color: '#dc2626', bg: '#fee2e2', icon: '🩸' },
  { id: 'Scan/X-ray', label: 'Scan/X-ray', color: '#7c3aed', bg: '#ede9fe', icon: '🩻' },
  { id: 'Prescription', label: 'Prescription', color: '#059669', bg: '#d1fae5', icon: '💊' },
  { id: 'Lab Report', label: 'Lab Report', color: '#0284c7', bg: '#e0f2fe', icon: '🧪' },
  { id: 'Discharge Summary', label: 'Discharge Summary', color: '#d97706', bg: '#fef3c7', icon: '📋' },
  { id: 'Other', label: 'Other', color: '#475569', bg: '#f1f5f9', icon: '📁' }
];

export const getCategoryMeta = (cat) => {
  if (!cat) return REPORT_CATEGORIES[5];
  const q = cat.toLowerCase();
  const found = REPORT_CATEGORIES.find((c) => 
    c.id.toLowerCase() === q || 
    c.label.toLowerCase() === q ||
    (q.includes('blood') && c.id === 'Blood Test') ||
    ((q.includes('scan') || q.includes('x-ray') || q.includes('xray')) && c.id === 'Scan/X-ray') ||
    (q.includes('prescription') && c.id === 'Prescription') ||
    (q.includes('lab') && c.id === 'Lab Report') ||
    (q.includes('discharge') && c.id === 'Discharge Summary')
  );
  return found || {
    id: cat,
    label: cat,
    color: '#475569',
    bg: '#f1f5f9',
    icon: '📄'
  };
};

export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 KB';
  const k = 1024;
  if (bytes < k * 1024) return (bytes / k).toFixed(1) + ' KB';
  return (bytes / (k * k)).toFixed(2) + ' MB';
};

// =========================================================================
// 1. REUSABLE UPLOAD MEDICAL REPORT MODAL
// =========================================================================
export function UploadMedicalReportModal({ doctors = [], onClose, onUploaded, patientId = null, isHealthWorker = false, managedPatients = [] }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Blood Test');
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [shareDoctorId, setShareDoctorId] = useState('');
  const [allowHw, setAllowHw] = useState(true);
  const [targetPatientId, setTargetPatientId] = useState(patientId || '');

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    setErrorMsg('');
    if (!f) {
      setFile(null);
      return;
    }

    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    const ext = f.name.split('.').pop().toLowerCase();
    if (!allowedMimes.includes(f.type) && !['pdf', 'jpg', 'jpeg', 'png'].includes(ext)) {
      setErrorMsg('Unsupported file format. Please select a PDF, JPG, JPEG, or PNG document.');
      setFile(null);
      return;
    }

    if (f.size > 15 * 1024 * 1024) {
      setErrorMsg('File is too large. Maximum supported file size is 15MB.');
      setFile(null);
      return;
    }

    setFile(f);
    if (!title.trim()) {
      const baseName = f.name.substring(0, f.name.lastIndexOf('.')) || f.name;
      setTitle(baseName.replace(/[-_]/g, ' '));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (isHealthWorker && !targetPatientId) {
      setErrorMsg('Please select which patient this report belongs to.');
      return;
    }

    if (!file) {
      setErrorMsg('Please select a report file to upload (PDF, JPG, JPEG, or PNG).');
      return;
    }

    if (!title.trim()) {
      setErrorMsg('Please enter a report title.');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(20);

      const formData = new FormData();
      formData.append('report_file', file);
      formData.append('title', title.trim());
      formData.append('category', category);
      formData.append('description', description.trim());
      formData.append('report_date', reportDate);
      formData.append('allow_health_worker_access', allowHw ? 'true' : 'false');
      if (shareDoctorId) {
        formData.append('share_doctor_id', shareDoctorId);
      }
      if (isHealthWorker && targetPatientId) {
        formData.append('patient_id', targetPatientId);
      }

      setUploadProgress(50);
      await api.post('/medical-reports', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const p = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(Math.min(95, p));
          }
        }
      });

      setUploadProgress(100);
      if (onUploaded) onUploaded();
      onClose();
    } catch (err) {
      console.error('Upload failed:', err);
      setErrorMsg(err.response?.data?.error || 'Failed to upload report. Please check file format and size.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="report-modal-backdrop" onClick={() => !uploading && onClose()}>
      <div className="report-form-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="report-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="brand-icon" style={{ width: 34, height: 34 }}>
              <Upload size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                {isHealthWorker ? 'Upload Report for Patient' : 'Upload Medical Report'}
              </h3>
              <small style={{ color: 'var(--text-muted)' }}>
                PDF, JPG, JPEG, or PNG documents (Up to 15MB)
              </small>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => !uploading && onClose()}
            style={{ fontSize: '1.3rem', color: '#64748b' }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="report-modal-body" style={{ padding: 24 }}>
          {errorMsg && (
            <div className="alert alert-danger" style={{ marginBottom: 16 }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* If Health Worker, select patient */}
          {isHealthWorker && (
            <div style={{ marginBottom: 16 }}>
              <label className="form-label">
                Select Patient <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                className="form-input"
                value={targetPatientId}
                onChange={(e) => setTargetPatientId(e.target.value)}
                required
              >
                <option value="">Choose an assigned patient...</option>
                {managedPatients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (ID: #{p.id}{p.phone ? ` · ${p.phone}` : ''})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* File Picker / Dropzone */}
          <div style={{ marginBottom: 18 }}>
            <label className="form-label">
              Select Document / Scan File <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <div className="report-file-dropzone">
              <input
                type="file"
                id="modalFileInput"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <label htmlFor="modalFileInput" style={{ cursor: 'pointer', width: '100%', display: 'block' }}>
                <div style={{ textAlign: 'center', padding: '22px 16px' }}>
                  <Upload size={32} color="var(--primary)" style={{ margin: '0 auto 8px' }} />
                  {file ? (
                    <div>
                      <b style={{ color: '#0369a1', fontSize: '0.96rem' }}>{file.name}</b>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
                        {formatFileSize(file.size)} · Click to change file
                      </div>
                    </div>
                  ) : (
                    <div>
                      <b style={{ color: 'var(--text-main)', fontSize: '0.96rem' }}>
                        Click to select PDF or image file
                      </b>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        Scanned reports, lab test results, blood tests, X-rays, prescriptions (Max 15MB)
                      </div>
                    </div>
                  )}
                </div>
              </label>
            </div>
          </div>

          {/* Report Title & Category */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
            <div>
              <label className="form-label">
                Report Title <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Complete Blood Count (CBC) or Chest X-Ray"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="form-label">
                Report Category <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                className="form-input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {REPORT_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Report Date & Immediate Doctor Share */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14, marginBottom: 16 }}>
            <div>
              <label className="form-label">Report Date</label>
              <input
                type="date"
                className="form-input"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
              />
            </div>

            <div>
              <label className="form-label">Share Immediately with Doctor</label>
              <select
                className="form-input"
                value={shareDoctorId}
                onChange={(e) => setShareDoctorId(e.target.value)}
              >
                <option value="">Keep Private (Do not share yet)</option>
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    Dr. {d.name} ({d.specialization})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 16 }}>
            <label className="form-label">Description / Clinical Context (Optional)</label>
            <textarea
              className="form-input"
              rows={2}
              placeholder="e.g. Test done at Apollo Diagnostics; fasting test taken on doctor recommendation..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Health Worker Access Checkbox */}
          {!isHealthWorker && (
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 8,
                padding: '12px 14px',
                marginBottom: 20,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10
              }}
            >
              <input
                type="checkbox"
                id="modalHwAccess"
                checked={allowHw}
                onChange={(e) => setAllowHw(e.target.checked)}
                style={{ marginTop: 3, cursor: 'pointer', width: 16, height: 16 }}
              />
              <label htmlFor="modalHwAccess" style={{ fontSize: '0.85rem', color: '#334155', cursor: 'pointer', lineHeight: 1.4 }}>
                <b>Allow assigned Community Health Worker to access this report</b>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>
                  Enables your rural community health worker to assist during home visits and follow-ups.
                </div>
              </label>
            </div>
          )}

          {/* Upload Progress Bar if uploading */}
          {uploading && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 4, color: '#0369a1', fontWeight: 600 }}>
                <span>Uploading and encrypting document...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div style={{ width: '100%', height: 6, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${uploadProgress}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.2s ease' }} />
              </div>
            </div>
          )}

          {/* Submit buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={onClose}
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={uploading || !file}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700 }}
            >
              {uploading ? (
                <>
                  <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  <span>Uploading Report...</span>
                </>
              ) : (
                <>
                  <Upload size={16} />
                  <span>Upload Report</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =========================================================================
// 2. DOCUMENT PREVIEW MODAL (Authenticated Blob Preview for PDF & Images)
// =========================================================================
export function DocumentPreviewModal({ reportId, report: initialReport, onClose }) {
  const [report, setReport] = useState(initialReport || null);
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let activeUrl = null;
    setLoading(true);
    setError('');

    const targetId = reportId || initialReport?.id;
    if (!targetId) {
      setError('Report ID missing.');
      setLoading(false);
      return;
    }

    Promise.all([
      api.get(`/medical-reports/${targetId}`),
      api.get(`/medical-reports/${targetId}/preview`, { responseType: 'blob' })
    ])
      .then(([metaRes, fileRes]) => {
        setReport(metaRes.data);
        const url = URL.createObjectURL(fileRes.data);
        activeUrl = url;
        setBlobUrl(url);
      })
      .catch((err) => {
        console.error('Failed to preview document:', err);
        setError(err.response?.data?.error || 'Unable to load report document. Please check permissions.');
      })
      .finally(() => setLoading(false));

    return () => {
      if (activeUrl) {
        URL.revokeObjectURL(activeUrl);
      }
    };
  }, [reportId, initialReport?.id]);

  const handleDownload = async () => {
    const targetId = report?.id || reportId;
    if (!targetId) return;
    try {
      setDownloading(true);
      const res = await api.get(`/medical-reports/${targetId}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = report?.original_file_name || `medical_report_${targetId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to download report.');
    } finally {
      setDownloading(false);
    }
  };

  const isPdf = report?.file_type === 'application/pdf' || report?.original_file_name?.toLowerCase().endsWith('.pdf');
  const catMeta = getCategoryMeta(report?.category);

  return (
    <div className="report-modal-backdrop" onClick={onClose}>
      <div
        className="report-preview-modal-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="report-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: '1.6rem' }}>{catMeta.icon}</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '1.18rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  {report?.title || 'Medical Report Preview'}
                </h3>
                <span
                  style={{
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    padding: '3px 9px',
                    borderRadius: 12,
                    background: catMeta.bg,
                    color: catMeta.color
                  }}
                >
                  {catMeta.label}
                </span>
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 2 }}>
                Report Date: <b>{report?.report_date ? report.report_date.slice(0, 10) : 'N/A'}</b>
                {report?.patient_name && (
                  <span> · Patient: <b>{report.patient_name}</b></span>
                )}
                <span> · Size: {formatFileSize(report?.file_size)}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleDownload}
              disabled={downloading || loading || !!error}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
            >
              <Download size={15} />
              <span>{downloading ? 'Downloading...' : 'Download'}</span>
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onClose}
              style={{ fontSize: '1.3rem', lineHeight: 1, padding: '4px 10px', color: '#64748b' }}
              title="Close Preview"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="report-modal-body">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
              <div className="spinner" style={{ margin: '0 auto 16px' }} />
              <p style={{ fontWeight: 600 }}>Loading secure medical document...</p>
              <small>Decrypting and fetching authenticated preview</small>
            </div>
          ) : error ? (
            <div className="alert alert-danger" style={{ margin: 20 }}>
              <AlertCircle size={22} style={{ flexShrink: 0 }} />
              <div>
                <b>Unable to Preview Document</b>
                <div style={{ fontSize: '0.86rem', marginTop: 4 }}>{error}</div>
              </div>
            </div>
          ) : (
            <div className="report-preview-container">
              {isPdf ? (
                <iframe
                  src={blobUrl}
                  title={report?.title || 'Medical Document'}
                  className="report-pdf-frame"
                />
              ) : (
                <div className="report-image-wrapper">
                  <img
                    src={blobUrl}
                    alt={report?.title || 'Report preview'}
                    className="report-image-view"
                  />
                </div>
              )}
            </div>
          )}

          {/* Description & Clinical Observations Footer */}
          {report && (
            <div className="report-preview-meta-panel">
              {report.description && (
                <div style={{ marginBottom: 12 }}>
                  <b style={{ fontSize: '0.82rem', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Patient Notes / Description:
                  </b>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginTop: 4, background: '#f8fafc', padding: 10, borderRadius: 8 }}>
                    {report.description}
                  </p>
                </div>
              )}

              {/* Clinical Observations by Doctors */}
              {report.clinical_notes && report.clinical_notes.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <b style={{ fontSize: '0.82rem', color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Stethoscope size={15} /> Doctor Clinical Notes & Observations:
                  </b>
                  <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {report.clinical_notes.map((n) => (
                      <div
                        key={n.id}
                        style={{
                          background: '#f0f9ff',
                          border: '1px solid #bae6fd',
                          borderRadius: 8,
                          padding: '10px 14px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: '#0284c7', fontWeight: 700 }}>
                          <span>Dr. {n.doctor_name} ({n.specialization})</span>
                          <span>{n.created_at?.slice(0, 10)}</span>
                        </div>
                        <div style={{ fontSize: '0.9rem', color: '#0c4a6e', marginTop: 4, whiteSpace: 'pre-line' }}>
                          {n.notes}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Shared recipients */}
              {report.shares && report.shares.length > 0 && (
                <div style={{ marginTop: 12, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  <b>Authorized Sharing:</b> Shared with{' '}
                  {report.shares.map((s, idx) => (
                    <span key={s.id} style={{ fontWeight: 700, color: 'var(--primary)' }}>
                      Dr. {s.doctor_name}{idx < report.shares.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// 3. SHARE REPORT MODAL (Select doctor, grant/revoke access)
// =========================================================================
export function ShareReportModal({ report, doctors, onClose, onUpdated }) {
  const [selectedDocId, setSelectedDocId] = useState('');
  const [shareNote, setShareNote] = useState('');
  const [sharing, setSharing] = useState(false);
  const [allowHw, setAllowHw] = useState(!!report.allow_health_worker_access);
  const [updatingHw, setUpdatingHw] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const currentShares = report.shared_doctors || [];

  const handleShare = async (e) => {
    e.preventDefault();
    if (!selectedDocId) {
      setErrorMsg('Please select a doctor to share this report with.');
      return;
    }
    setErrorMsg('');
    try {
      setSharing(true);
      await api.post(`/medical-reports/${report.id}/share`, {
        doctor_id: selectedDocId,
        notes: shareNote
      });
      setStatusMsg('Report shared with doctor successfully!');
      setSelectedDocId('');
      setShareNote('');
      if (onUpdated) onUpdated();
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to share report.');
    } finally {
      setSharing(false);
    }
  };

  const handleRevoke = async (shareId) => {
    if (!window.confirm('Are you sure you want to revoke this doctor\'s access to this report?')) return;
    try {
      await api.delete(`/medical-reports/${report.id}/share/${shareId}`);
      setStatusMsg('Doctor access revoked successfully.');
      if (onUpdated) onUpdated();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to revoke access.');
    }
  };

  const handleToggleHwAccess = async (newVal) => {
    try {
      setUpdatingHw(true);
      await api.patch(`/medical-reports/${report.id}/health-worker-access`, {
        allow_health_worker_access: newVal
      });
      setAllowHw(newVal);
      setStatusMsg(`Health worker access ${newVal ? 'granted' : 'revoked'} successfully.`);
      if (onUpdated) onUpdated();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update health worker access.');
    } finally {
      setUpdatingHw(false);
    }
  };

  return (
    <div className="report-modal-backdrop" onClick={onClose}>
      <div className="report-form-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="report-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Share2 size={20} color="var(--primary)" />
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>
                Share Medical Report
              </h3>
              <small style={{ color: 'var(--text-muted)' }}>{report.title} ({report.category})</small>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={onClose}
            style={{ fontSize: '1.3rem', color: '#64748b' }}
          >
            ×
          </button>
        </div>

        <div className="report-modal-body" style={{ padding: 24 }}>
          {statusMsg && (
            <div className="alert alert-success" style={{ marginBottom: 14 }}>
              <CheckCircle2 size={16} />
              <span>{statusMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="alert alert-danger" style={{ marginBottom: 14 }}>
              <AlertCircle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Currently Authorized Doctors */}
          <div style={{ marginBottom: 20 }}>
            <label className="form-label" style={{ marginBottom: 8 }}>
              Currently Authorized Doctors ({currentShares.length})
            </label>
            {currentShares.length === 0 ? (
              <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 8, fontSize: '0.86rem', color: '#64748b' }}>
                🔒 This report is currently private. No doctors have access.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {currentShares.map((s) => (
                  <div
                    key={s.share_id || s.doctor_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#f0f9ff',
                      border: '1px solid #bae6fd',
                      borderRadius: 8,
                      padding: '10px 14px'
                    }}
                  >
                    <div>
                      <b style={{ color: '#0369a1', fontSize: '0.92rem' }}>Dr. {s.doctor_name}</b>
                      <div style={{ fontSize: '0.78rem', color: '#0284c7' }}>
                        {s.specialization} · Shared on {s.shared_at?.slice(0, 10)}
                      </div>
                    </div>
                    {s.share_id && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleRevoke(s.share_id)}
                        style={{ color: '#dc2626', fontSize: '0.8rem', fontWeight: 700 }}
                      >
                        Revoke Access
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Share with New Doctor Form */}
          <form onSubmit={handleShare} style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 20 }}>
            <h4 style={{ fontSize: '0.94rem', fontWeight: 700, color: '#334155', marginBottom: 12 }}>
              Authorize Another Doctor:
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10, marginBottom: 12 }}>
              <div>
                <select
                  className="form-input"
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                  required
                >
                  <option value="">Select Consulting Doctor</option>
                  {doctors
                    .filter((d) => !currentShares.some((s) => s.doctor_id === d.id))
                    .map((d) => (
                      <option key={d.id} value={d.id}>
                        Dr. {d.name} ({d.specialization})
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Optional note for doctor..."
                  value={shareNote}
                  onChange={(e) => setShareNote(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={sharing || !selectedDocId}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
            >
              <Share2 size={14} />
              <span>{sharing ? 'Granting Access...' : 'Authorize Doctor'}</span>
            </button>
          </form>

          {/* Health Worker Access Toggle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: 8,
              padding: '12px 16px'
            }}
          >
            <div>
              <b style={{ fontSize: '0.88rem', color: '#334155' }}>Community Health Worker Access</b>
              <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                Permit authorized health worker assigned to your care to view this report
              </div>
            </div>
            <button
              type="button"
              className={`btn btn-sm ${allowHw ? 'btn-success' : 'btn-outline'}`}
              onClick={() => handleToggleHwAccess(!allowHw)}
              disabled={updatingHw}
              style={{ fontWeight: 700 }}
            >
              {updatingHw ? 'Updating...' : allowHw ? '✓ Granted' : 'Disabled'}
            </button>
          </div>
        </div>

        <div className="report-modal-footer">
          <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
// 4. PATIENT DASHBOARD REPORTS SECTION (Directly displayed on PatientHome!)
// =========================================================================
export function PatientDashboardReportsSection({ onNavigate, user }) {
  const [reports, setReports] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [previewReport, setPreviewReport] = useState(null);
  const [shareReport, setShareReport] = useState(null);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.get('/medical-reports'),
      api.get('/doctors')
    ])
      .then(([repRes, docRes]) => {
        setReports(repRes.data || []);
        setDoctors(docRes.data || []);
      })
      .catch((err) => console.error('Error loading dashboard reports:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDownload = async (report) => {
    try {
      const res = await api.get(`/medical-reports/${report.id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = report.original_file_name || `report_${report.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download report.');
    }
  };

  return (
    <div className="card" style={{ padding: '20px 24px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 18, borderBottom: '1px solid #f1f5f9', paddingBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="stat-icon purple" style={{ width: 44, height: 44 }}>
            <FileText size={22} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.18rem', fontWeight: 800, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span>My Medical Reports</span>
              {reports.length > 0 && (
                <span style={{ fontSize: '0.78rem', background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>
                  {reports.length}
                </span>
              )}
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Upload and securely manage your scans, lab test results, blood tests, and prescriptions
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowUploadModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700, boxShadow: '0 2px 8px rgba(2, 132, 199, 0.25)' }}
          >
            <Upload size={16} />
            <span>Upload Medical Report</span>
          </button>
          {onNavigate && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => onNavigate('medical-reports')}
              style={{ fontWeight: 600 }}
            >
              View All
            </button>
          )}
        </div>
      </div>

      {/* Success notification banner */}
      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Reports List / Empty State */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 10px', width: 24, height: 24 }} />
          <p style={{ fontSize: '0.9rem' }}>Loading medical reports...</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="empty-state" style={{ padding: '36px 16px', textAlign: 'center', background: '#f8fafc', borderRadius: 10 }}>
          <FileText size={44} color="#94a3b8" style={{ margin: '0 auto 10px' }} />
          <h4 style={{ fontSize: '1.08rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: 6 }}>
            No medical reports uploaded yet
          </h4>
          <p style={{ color: 'var(--text-muted)', maxWidth: 440, margin: '0 auto 16px', fontSize: '0.88rem' }}>
            Upload your scanned reports, lab test results, blood test reports, X-rays, prescriptions, and discharge summaries to securely share them with your doctor.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowUploadModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            <Upload size={15} />
            <span>Upload Medical Report</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 14 }}>
          {reports.slice(0, 4).map((r) => {
            const catMeta = getCategoryMeta(r.category);
            const sharedDocs = r.shared_doctors || [];
            const isShared = sharedDocs.length > 0;
            const isPdf = r.file_type === 'application/pdf' || r.original_file_name?.toLowerCase().endsWith('.pdf');

            return (
              <div
                key={r.id}
                style={{
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: 10,
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 10,
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span
                      style={{
                        background: catMeta.bg,
                        color: catMeta.color,
                        padding: '3px 8px',
                        borderRadius: 12,
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <span>{catMeta.icon}</span>
                      <span>{catMeta.label}</span>
                    </span>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      📅 {r.report_date ? r.report_date.slice(0, 10) : 'N/A'}
                    </span>
                  </div>

                  <b style={{ fontSize: '0.96rem', color: 'var(--text-main)', display: 'block', lineHeight: 1.35 }}>
                    {r.title}
                  </b>

                  <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FileText size={14} color={isPdf ? '#dc2626' : '#0284c7'} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                      {r.original_file_name}
                    </span>
                    <span>· {formatFileSize(r.file_size)}</span>
                  </div>

                  {/* Sharing status chip */}
                  <div style={{ marginTop: 8 }}>
                    {isShared ? (
                      <span
                        style={{
                          background: '#dbeafe',
                          color: '#1e40af',
                          padding: '2px 7px',
                          borderRadius: 6,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4
                        }}
                      >
                        <Stethoscope size={12} />
                        <span>Shared with Dr. {sharedDocs[0].doctor_name}{sharedDocs.length > 1 ? ` (+${sharedDocs.length - 1})` : ''}</span>
                      </span>
                    ) : (
                      <span style={{ background: '#f1f5f9', color: '#64748b', padding: '2px 7px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 600 }}>
                        🔒 Private
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => setPreviewReport(r)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: '0.78rem', fontWeight: 700 }}
                    >
                      <Eye size={13} />
                      <span>Preview</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setShareReport(r)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', fontSize: '0.78rem', fontWeight: 700 }}
                    >
                      <Share2 size={13} />
                      <span>Share</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleDownload(r)}
                    style={{ padding: '4px 8px', color: '#475569' }}
                    title="Download file"
                  >
                    <Download size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showUploadModal && (
        <UploadMedicalReportModal
          doctors={doctors}
          onClose={() => setShowUploadModal(false)}
          onUploaded={() => {
            setSuccessMsg('Medical report uploaded successfully!');
            setTimeout(() => setSuccessMsg(''), 4000);
            loadData();
          }}
        />
      )}

      {previewReport && (
        <DocumentPreviewModal
          reportId={previewReport.id}
          report={previewReport}
          onClose={() => setPreviewReport(null)}
        />
      )}

      {shareReport && (
        <ShareReportModal
          report={shareReport}
          doctors={doctors}
          onClose={() => setShareReport(null)}
          onUpdated={() => loadData()}
        />
      )}
    </div>
  );
}

// =========================================================================
// 5. PATIENT FULL MEDICAL REPORTS VIEW (My Medical Reports Tab)
// =========================================================================
export function PatientMedicalReportsView() {
  const [reports, setReports] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [shareTargetReport, setShareTargetReport] = useState(null);
  const [previewTargetReport, setPreviewTargetReport] = useState(null);

  // Filters & Search
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.get('/medical-reports'),
      api.get('/doctors')
    ])
      .then(([repRes, docRes]) => {
        setReports(repRes.data || []);
        setDoctors(docRes.data || []);
      })
      .catch((err) => console.error('Failed to load reports:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteReport = async (reportId) => {
    if (!window.confirm('Are you sure you want to delete this medical report? This will remove the document permanently.')) {
      return;
    }
    try {
      await api.delete(`/medical-reports/${reportId}`);
      setSuccessMsg('Report deleted successfully.');
      setTimeout(() => setSuccessMsg(''), 3000);
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete report.');
    }
  };

  const filteredReports = reports.filter((r) => {
    if (filterCategory !== 'ALL' && r.category !== filterCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = r.title?.toLowerCase().includes(q);
      const matchDesc = r.description?.toLowerCase().includes(q);
      const matchCat = r.category?.toLowerCase().includes(q);
      const matchFile = r.original_file_name?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchCat && !matchFile) return false;
    }
    return true;
  });

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">My Medical Reports</h2>
          <p className="page-subtitle">
            Upload, view, and securely share your diagnostic scans, lab results, prescriptions, and health records
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowUploadModal(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700 }}
        >
          <Upload size={17} />
          <span>Upload Medical Report</span>
        </button>
      </div>

      {/* Success banner */}
      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: 20 }}>
          <CheckCircle2 size={20} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Overview Stat Cards */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card">
          <div className="stat-icon blue">
            <FileText size={24} />
          </div>
          <div>
            <div className="stat-value">{reports.length}</div>
            <div className="stat-label">Uploaded Medical Documents</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <Share2 size={24} />
          </div>
          <div>
            <div className="stat-value">
              {reports.filter((r) => r.shared_doctors && r.shared_doctors.length > 0).length}
            </div>
            <div className="stat-label">Shared with Doctors</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon teal">
            <Users size={24} />
          </div>
          <div>
            <div className="stat-value">
              {reports.filter((r) => r.allow_health_worker_access).length}
            </div>
            <div className="stat-label">Health Worker Accessible</div>
          </div>
        </div>
      </div>

      {/* Search and Filters Toolbar */}
      <div
        className="card"
        style={{
          marginBottom: 20,
          padding: '16px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
          <Search size={18} color="var(--text-muted)" />
          <input
            type="text"
            className="form-input"
            style={{ width: '100%', maxWidth: 360 }}
            placeholder="Search reports by title, category, or filename..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Filter size={16} color="var(--text-muted)" />
          <span style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-muted)' }}>Category:</span>
          <select
            className="form-input"
            style={{ padding: '6px 12px', minWidth: 160 }}
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="ALL">All Categories</option>
            {REPORT_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Reports List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          <p>Loading your medical reports...</p>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="empty-state card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <FileText size={48} color="#94a3b8" style={{ marginBottom: 14 }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: 6 }}>
            {reports.length === 0 ? 'No medical reports uploaded yet' : 'No reports match your filters'}
          </h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: 460, margin: '0 auto 18px', fontSize: '0.92rem' }}>
            {reports.length === 0
              ? 'Upload your diagnostic lab test results, blood work, X-rays, scan reports, and prescriptions to securely access them anytime and share with your doctor.'
              : 'Try selecting a different category filter or clearing your search query.'}
          </p>
          {reports.length === 0 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowUploadModal(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              <Upload size={16} />
              <span>Upload Medical Report</span>
            </button>
          )}
        </div>
      ) : (
        <div className="reports-grid">
          {filteredReports.map((r) => {
            const catMeta = getCategoryMeta(r.category);
            const sharedDocs = r.shared_doctors || [];
            const isShared = sharedDocs.length > 0;
            const isPdf = r.file_type === 'application/pdf' || r.original_file_name?.toLowerCase().endsWith('.pdf');

            return (
              <div key={r.id} className="card report-item-card">
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                    <span
                      style={{
                        background: catMeta.bg,
                        color: catMeta.color,
                        padding: '4px 10px',
                        borderRadius: 14,
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5
                      }}
                    >
                      <span>{catMeta.icon}</span>
                      <span>{catMeta.label}</span>
                    </span>

                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Calendar size={13} />
                      <span>{r.report_date ? r.report_date.slice(0, 10) : 'N/A'}</span>
                    </span>
                  </div>

                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: 6, lineHeight: 1.35 }}>
                    {r.title}
                  </h4>

                  {r.description ? (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 12, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {r.description}
                    </p>
                  ) : (
                    <div style={{ marginBottom: 12 }} />
                  )}

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: 8,
                      padding: '8px 12px',
                      marginBottom: 12,
                      fontSize: '0.8rem',
                      color: '#475569'
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '70%' }}>
                      <FileText size={15} color={isPdf ? '#dc2626' : '#0284c7'} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.original_file_name}</span>
                    </span>
                    <span style={{ fontWeight: 700, color: '#64748b' }}>{formatFileSize(r.file_size)}</span>
                  </div>

                  {/* Sharing status */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {isShared ? (
                        sharedDocs.map((d) => (
                          <span
                            key={d.doctor_id}
                            style={{
                              background: '#dbeafe',
                              color: '#1e40af',
                              padding: '3px 8px',
                              borderRadius: 6,
                              fontSize: '0.74rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            <Stethoscope size={12} />
                            <span>Dr. {d.doctor_name}</span>
                          </span>
                        ))
                      ) : (
                        <span
                          style={{
                            background: '#f1f5f9',
                            color: '#64748b',
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: '0.74rem',
                            fontWeight: 700
                          }}
                        >
                          🔒 Private (Not shared)
                        </span>
                      )}

                      {r.allow_health_worker_access && (
                        <span
                          style={{
                            background: '#ccfbf1',
                            color: '#0f766e',
                            padding: '3px 8px',
                            borderRadius: 6,
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                          title="Authorized health worker can view this report"
                        >
                          <ShieldCheck size={12} />
                          <span>HW Access</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingTop: 12, borderTop: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => setPreviewTargetReport(r)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700 }}
                    >
                      <Eye size={14} />
                      <span>Preview</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => setShareTargetReport(r)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700 }}
                    >
                      <Share2 size={14} />
                      <span>Share</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleDeleteReport(r.id)}
                    style={{ color: '#ef4444', padding: '6px 8px' }}
                    title="Delete report"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* UPLOAD REPORT MODAL */}
      {showUploadModal && (
        <UploadMedicalReportModal
          doctors={doctors}
          onClose={() => setShowUploadModal(false)}
          onUploaded={() => {
            setSuccessMsg('Medical report uploaded successfully!');
            setTimeout(() => setSuccessMsg(''), 4000);
            loadData();
          }}
        />
      )}

      {/* SHARE / PERMISSION MODAL */}
      {shareTargetReport && (
        <ShareReportModal
          report={shareTargetReport}
          doctors={doctors}
          onClose={() => setShareTargetReport(null)}
          onUpdated={() => loadData()}
        />
      )}

      {/* PREVIEW MODAL */}
      {previewTargetReport && (
        <DocumentPreviewModal
          reportId={previewTargetReport.id}
          report={previewTargetReport}
          onClose={() => setPreviewTargetReport(null)}
        />
      )}
    </div>
  );
}

// =========================================================================
// 6. DOCTOR DASHBOARD REPORTS SECTION (Directly displayed on DoctorDashboardHome!)
// =========================================================================
export function DoctorDashboardReportsSection({ onNavigate }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewReport, setPreviewReport] = useState(null);

  useEffect(() => {
    setLoading(true);
    api.get('/medical-reports')
      .then((res) => setReports(res.data || []))
      .catch((err) => console.error('Failed to load doctor dashboard reports:', err))
      .finally(() => setLoading(false));
  }, []);

  const handleDownload = async (report) => {
    try {
      const res = await api.get(`/medical-reports/${report.id}/download`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = report.original_file_name || `report_${report.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to download report.');
    }
  };

  return (
    <div className="card" style={{ padding: '20px 24px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16, borderBottom: '1px solid #f1f5f9', paddingBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="stat-icon blue" style={{ width: 40, height: 40 }}>
            <FileText size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.12rem', fontWeight: 800, margin: 0 }}>Patient Medical Reports</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
              Diagnostic reports and scans shared directly with your clinical profile
            </p>
          </div>
        </div>

        {onNavigate && (
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => onNavigate('patient-reports')}
            style={{ fontWeight: 600 }}
          >
            Manage All Reports
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 8px', width: 20, height: 20 }} />
          <p style={{ fontSize: '0.86rem' }}>Loading shared reports...</p>
        </div>
      ) : reports.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '28px 16px', background: '#f8fafc', borderRadius: 8, color: 'var(--text-muted)' }}>
          <FileText size={36} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
          <div style={{ fontSize: '0.92rem', fontWeight: 600 }}>No patient reports shared yet</div>
          <small style={{ fontSize: '0.78rem' }}>When patients share lab results, blood tests, or scans with you, they will appear here.</small>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Report Title</th>
                <th>Category</th>
                <th>Report Date</th>
                <th>File</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.slice(0, 5).map((r) => {
                const catMeta = getCategoryMeta(r.category);
                return (
                  <tr key={r.id}>
                    <td>
                      <b>{r.patient_name}</b>
                      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>ID: #{r.patient_id}</div>
                    </td>
                    <td><b>{r.title}</b></td>
                    <td>
                      <span style={{ background: catMeta.bg, color: catMeta.color, padding: '2px 8px', borderRadius: 10, fontSize: '0.72rem', fontWeight: 700 }}>
                        {catMeta.icon} {catMeta.label}
                      </span>
                    </td>
                    <td>{r.report_date ? r.report_date.slice(0, 10) : 'N/A'}</td>
                    <td><small>{formatFileSize(r.file_size)}</small></td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => setPreviewReport(r)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: '0.76rem', fontWeight: 700 }}
                        >
                          <Eye size={13} />
                          <span>Preview</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => handleDownload(r)}
                          style={{ padding: '4px 8px' }}
                          title="Download"
                        >
                          <Download size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {previewReport && (
        <DocumentPreviewModal
          reportId={previewReport.id}
          report={previewReport}
          onClose={() => setPreviewReport(null)}
        />
      )}
    </div>
  );
}

// =========================================================================
// 7. DOCTOR FULL PATIENT REPORTS VIEW
// =========================================================================
export function DoctorPatientReportsView({ onNavigateToConsultation }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [previewReport, setPreviewReport] = useState(null);
  const [clinicalNoteReport, setClinicalNoteReport] = useState(null);

  // Filters
  const [selectedPatientId, setSelectedPatientId] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const loadDoctorReports = () => {
    setLoading(true);
    let url = '/medical-reports';
    const params = [];
    if (selectedPatientId !== 'ALL') params.push(`patient_id=${selectedPatientId}`);
    if (filterCategory !== 'ALL') params.push(`category=${encodeURIComponent(filterCategory)}`);
    if (params.length > 0) url += `?${params.join('&')}`;

    api.get(url)
      .then((res) => {
        setReports(res.data || []);
      })
      .catch((err) => console.error('Failed to load doctor reports:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDoctorReports();
  }, [selectedPatientId, filterCategory]);

  const distinctPatients = Array.from(
    new Map(reports.map((r) => [r.patient_id, { id: r.patient_id, name: r.patient_name || `Patient #${r.patient_id}` }])).values()
  );

  const filteredReports = reports.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.title?.toLowerCase().includes(q) ||
      r.patient_name?.toLowerCase().includes(q) ||
      r.category?.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Patient Medical Reports</h2>
          <p className="page-subtitle">
            Securely review diagnostic reports, lab results, and medical scans shared by authorized patients
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="card"
        style={{
          marginBottom: 20,
          padding: '16px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
          <Search size={18} color="var(--text-muted)" />
          <input
            type="text"
            className="form-input"
            style={{ width: '100%', maxWidth: 360 }}
            placeholder="Search by patient name, title, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <User size={16} color="var(--text-muted)" />
            <select
              className="form-input"
              style={{ padding: '6px 12px', minWidth: 160 }}
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
            >
              <option value="ALL">All Patients ({distinctPatients.length})</option>
              {distinctPatients.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Filter size={16} color="var(--text-muted)" />
            <select
              className="form-input"
              style={{ padding: '6px 12px', minWidth: 150 }}
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="ALL">All Categories</option>
              {REPORT_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          <p>Loading patient reports...</p>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="empty-state card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <FileCheck size={48} color="#94a3b8" style={{ marginBottom: 14 }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: 6 }}>
            No patient reports found
          </h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: 460, margin: '0 auto', fontSize: '0.92rem' }}>
            Only medical reports that patients have explicitly shared with your clinical profile appear here.
          </p>
        </div>
      ) : (
        <div className="table-responsive card" style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Patient Details</th>
                <th>Report Title & Category</th>
                <th>Report Date</th>
                <th>Shared Date</th>
                <th>Document Info</th>
                <th style={{ textAlign: 'right' }}>Clinical Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((r) => {
                const catMeta = getCategoryMeta(r.category);
                const isPdf = r.file_type === 'application/pdf' || r.original_file_name?.toLowerCase().endsWith('.pdf');

                return (
                  <tr key={r.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: '50%',
                            background: '#e0f2fe',
                            color: '#0284c7',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '0.88rem'
                          }}
                        >
                          {r.patient_name ? r.patient_name[0].toUpperCase() : 'P'}
                        </div>
                        <div>
                          <b style={{ color: 'var(--text-main)', fontSize: '0.92rem' }}>{r.patient_name}</b>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            ID: #{r.patient_id} {r.patient_gender ? `· ${r.patient_gender}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div>
                        <b style={{ fontSize: '0.94rem', color: 'var(--text-main)' }}>{r.title}</b>
                        <div style={{ marginTop: 3 }}>
                          <span
                            style={{
                              background: catMeta.bg,
                              color: catMeta.color,
                              padding: '2px 8px',
                              borderRadius: 10,
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            <span>{catMeta.icon}</span>
                            <span>{catMeta.label}</span>
                          </span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        {r.report_date ? r.report_date.slice(0, 10) : 'N/A'}
                      </span>
                    </td>

                    <td>
                      <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        {r.shared_at ? r.shared_at.slice(0, 10) : r.created_at?.slice(0, 10)}
                      </span>
                    </td>

                    <td>
                      <div style={{ fontSize: '0.82rem', color: '#475569' }}>
                        <span style={{ fontWeight: 600 }}>{isPdf ? 'PDF Document' : 'Image Scan'}</span>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem' }}>
                          {formatFileSize(r.file_size)}
                        </div>
                      </div>
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => setPreviewReport(r)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700 }}
                        >
                          <Eye size={14} />
                          <span>Preview</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => setClinicalNoteReport(r)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700 }}
                        >
                          <Edit3 size={14} />
                          <span>Notes</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* PREVIEW MODAL */}
      {previewReport && (
        <DocumentPreviewModal
          reportId={previewReport.id}
          report={previewReport}
          onClose={() => setPreviewReport(null)}
        />
      )}

      {/* DOCTOR CLINICAL NOTES MODAL */}
      {clinicalNoteReport && (
        <DoctorClinicalNoteModal
          report={clinicalNoteReport}
          onClose={() => setClinicalNoteReport(null)}
          onSaved={() => {
            setClinicalNoteReport(null);
            loadDoctorReports();
          }}
        />
      )}
    </div>
  );
}

// =========================================================================
// 8. DOCTOR CLINICAL NOTE MODAL
// =========================================================================
export function DoctorClinicalNoteModal({ report, onClose, onSaved }) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!note.trim()) {
      setError('Clinical note cannot be empty.');
      return;
    }
    try {
      setSaving(true);
      await api.post(`/medical-reports/${report.id}/notes`, { notes: note.trim() });
      if (onSaved) onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save clinical observation.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="report-modal-backdrop" onClick={onClose}>
      <div className="report-form-modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="report-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Stethoscope size={20} color="var(--primary)" />
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>Add Clinical Observation</h3>
              <small style={{ color: 'var(--text-muted)' }}>
                Report: {report.title} · Patient: {report.patient_name}
              </small>
            </div>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} style={{ fontSize: '1.3rem' }}>
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="report-modal-body" style={{ padding: 24 }}>
          {error && (
            <div className="alert alert-danger" style={{ marginBottom: 14 }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div style={{ marginBottom: 18 }}>
            <label className="form-label">
              Clinical Assessment & Observations <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <textarea
              className="form-input"
              rows={4}
              placeholder="e.g. Reviewed blood test results. Hemoglobin levels improved to 12.4 g/dL. Continue current iron supplement dosage for 4 weeks."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving || !note.trim()}>
              {saving ? 'Saving Note...' : 'Save Clinical Observation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// =========================================================================
// 9. HEALTH WORKER DASHBOARD REPORTS SECTION (For HealthWorkerHome)
// =========================================================================
export function HealthWorkerDashboardReportsSection({ onNavigate }) {
  const [reports, setReports] = useState([]);
  const [managedPatients, setManagedPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [previewReport, setPreviewReport] = useState(null);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.get('/medical-reports'),
      api.get('/health-worker/patients'),
      api.get('/doctors')
    ])
      .then(([repRes, pRes, dRes]) => {
        setReports(repRes.data || []);
        setManagedPatients(pRes.data || []);
        setDoctors(dRes.data || []);
      })
      .catch((err) => console.error('Failed to load HW dashboard reports:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="card" style={{ padding: '20px 24px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16, borderBottom: '1px solid #f1f5f9', paddingBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="stat-icon teal" style={{ width: 40, height: 40 }}>
            <FileText size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.12rem', fontWeight: 800, margin: 0 }}>Patient Medical Reports</h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: 0 }}>
              Authorized documents for managed patients in your assigned healthcare zone
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowUploadModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            <Upload size={14} />
            <span>Upload for Patient</span>
          </button>
          {onNavigate && (
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => onNavigate('patient-reports')}
            >
              View All
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '24px 16px', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 8px', width: 20, height: 20 }} />
          <p style={{ fontSize: '0.86rem' }}>Loading patient reports...</p>
        </div>
      ) : reports.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '28px 16px', background: '#f8fafc', borderRadius: 8, color: 'var(--text-muted)' }}>
          <FileText size={36} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
          <div style={{ fontSize: '0.92rem', fontWeight: 600 }}>No patient reports accessible yet</div>
          <small style={{ fontSize: '0.78rem' }}>Assist patients in your area by uploading their diagnostic reports.</small>
        </div>
      ) : (
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Title</th>
                <th>Category</th>
                <th>Report Date</th>
                <th>Doctor Sharing</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.slice(0, 5).map((r) => {
                const catMeta = getCategoryMeta(r.category);
                const isShared = (r.shared_doctors || []).length > 0;
                return (
                  <tr key={r.id}>
                    <td><b>{r.patient_name}</b></td>
                    <td>{r.title}</td>
                    <td>
                      <span style={{ background: catMeta.bg, color: catMeta.color, padding: '2px 8px', borderRadius: 10, fontSize: '0.72rem', fontWeight: 700 }}>
                        {catMeta.icon} {catMeta.label}
                      </span>
                    </td>
                    <td>{r.report_date ? r.report_date.slice(0, 10) : 'N/A'}</td>
                    <td>
                      {isShared ? (
                        <span style={{ color: '#059669', fontWeight: 700, fontSize: '0.76rem' }}>✓ Shared</span>
                      ) : (
                        <span style={{ color: '#64748b', fontSize: '0.76rem' }}>Private</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => setPreviewReport(r)}
                        style={{ padding: '3px 8px', fontSize: '0.76rem', fontWeight: 700 }}
                      >
                        Preview
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showUploadModal && (
        <UploadMedicalReportModal
          doctors={doctors}
          isHealthWorker={true}
          managedPatients={managedPatients}
          onClose={() => setShowUploadModal(false)}
          onUploaded={() => loadData()}
        />
      )}

      {previewReport && (
        <DocumentPreviewModal
          reportId={previewReport.id}
          report={previewReport}
          onClose={() => setPreviewReport(null)}
        />
      )}
    </div>
  );
}

// =========================================================================
// 10. HEALTH WORKER FULL PATIENT REPORTS VIEW
// =========================================================================
export function HealthWorkerPatientReportsView() {
  const [reports, setReports] = useState([]);
  const [managedPatients, setManagedPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');

  // Modals
  const [previewReport, setPreviewReport] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [shareReport, setShareReport] = useState(null);

  // Filters
  const [selectedPatientId, setSelectedPatientId] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = () => {
    setLoading(true);
    let url = '/medical-reports';
    const params = [];
    if (selectedPatientId !== 'ALL') params.push(`patient_id=${selectedPatientId}`);
    if (filterCategory !== 'ALL') params.push(`category=${encodeURIComponent(filterCategory)}`);
    if (params.length > 0) url += `?${params.join('&')}`;

    Promise.all([
      api.get(url),
      api.get('/health-worker/patients'),
      api.get('/doctors')
    ])
      .then(([repRes, pRes, dRes]) => {
        setReports(repRes.data || []);
        setManagedPatients(pRes.data || []);
        setDoctors(dRes.data || []);
      })
      .catch((err) => console.error('Failed to load health worker reports:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [selectedPatientId, filterCategory]);

  const filteredReports = reports.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.title?.toLowerCase().includes(q) ||
      r.patient_name?.toLowerCase().includes(q) ||
      r.category?.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Patient Medical Reports</h2>
          <p className="page-subtitle">
            Access authorized patient documents and assist patients with uploading and sharing medical reports
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowUploadModal(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700 }}
        >
          <Upload size={17} />
          <span>Upload Report for Patient</span>
        </button>
      </div>

      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: 20 }}>
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Filters Toolbar */}
      <div
        className="card"
        style={{
          marginBottom: 20,
          padding: '16px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
          <Search size={18} color="var(--text-muted)" />
          <input
            type="text"
            className="form-input"
            style={{ width: '100%', maxWidth: 360 }}
            placeholder="Search reports by title or patient..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Users size={16} color="var(--text-muted)" />
            <select
              className="form-input"
              style={{ padding: '6px 12px', minWidth: 160 }}
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
            >
              <option value="ALL">All Managed Patients</option>
              {managedPatients.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Filter size={16} color="var(--text-muted)" />
            <select
              className="form-input"
              style={{ padding: '6px 12px', minWidth: 150 }}
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="ALL">All Categories</option>
              {REPORT_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Reports Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          <p>Loading authorized reports...</p>
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="empty-state card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <FileText size={48} color="#94a3b8" style={{ marginBottom: 14 }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: 6 }}>
            No patient reports found
          </h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: 460, margin: '0 auto 18px', fontSize: '0.92rem' }}>
            You can assist assigned patients in your village or health centre by uploading their paper documents, lab test reports, or scan photos.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowUploadModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <Upload size={16} />
            <span>Upload Report for Patient</span>
          </button>
        </div>
      ) : (
        <div className="table-responsive card" style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Report Title & Category</th>
                <th>Report Date</th>
                <th>Doctor Sharing Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((r) => {
                const catMeta = getCategoryMeta(r.category);
                const sharedDocs = r.shared_doctors || [];
                const isShared = sharedDocs.length > 0;

                return (
                  <tr key={r.id}>
                    <td>
                      <div>
                        <b style={{ color: 'var(--text-main)', fontSize: '0.92rem' }}>{r.patient_name}</b>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          ID: #{r.patient_id} {r.patient_phone ? `· ${r.patient_phone}` : ''}
                        </div>
                      </div>
                    </td>

                    <td>
                      <div>
                        <b style={{ fontSize: '0.94rem', color: 'var(--text-main)' }}>{r.title}</b>
                        <div style={{ marginTop: 3 }}>
                          <span
                            style={{
                              background: catMeta.bg,
                              color: catMeta.color,
                              padding: '2px 8px',
                              borderRadius: 10,
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4
                            }}
                          >
                            <span>{catMeta.icon}</span>
                            <span>{catMeta.label}</span>
                          </span>
                        </div>
                      </div>
                    </td>

                    <td>
                      <span style={{ fontSize: '0.86rem', color: 'var(--text-main)' }}>
                        {r.report_date ? r.report_date.slice(0, 10) : 'N/A'}
                      </span>
                    </td>

                    <td>
                      {isShared ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {sharedDocs.map((d) => (
                            <span
                              key={d.doctor_id}
                              style={{
                                background: '#dbeafe',
                                color: '#1e40af',
                                padding: '2px 6px',
                                borderRadius: 6,
                                fontSize: '0.72rem',
                                fontWeight: 700
                              }}
                            >
                              Dr. {d.doctor_name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.76rem', color: '#64748b', fontStyle: 'italic' }}>
                          Not shared with doctor
                        </span>
                      )}
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => setPreviewReport(r)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700 }}
                        >
                          <Eye size={14} />
                          <span>Preview</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => setShareReport(r)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 700 }}
                        >
                          <Share2 size={14} />
                          <span>Share</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showUploadModal && (
        <UploadMedicalReportModal
          doctors={doctors}
          isHealthWorker={true}
          managedPatients={managedPatients}
          onClose={() => setShowUploadModal(false)}
          onUploaded={() => {
            setSuccessMsg('Patient medical report uploaded successfully!');
            setTimeout(() => setSuccessMsg(''), 4000);
            loadData();
          }}
        />
      )}

      {previewReport && (
        <DocumentPreviewModal
          reportId={previewReport.id}
          report={previewReport}
          onClose={() => setPreviewReport(null)}
        />
      )}

      {shareReport && (
        <ShareReportModal
          report={shareReport}
          doctors={doctors}
          onClose={() => setShareReport(null)}
          onUpdated={() => loadData()}
        />
      )}
    </div>
  );
}

// =========================================================================
// 11. TELECONSULTATION ROOM EMBEDDED REPORTS PANEL
// =========================================================================
export function TeleconsultationReportsPanel({ appointmentId, user }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewReport, setPreviewReport] = useState(null);

  const fetchReports = () => {
    if (!appointmentId) return;
    setLoading(true);
    api.get(`/consultations/${appointmentId}/reports`)
      .then((res) => setReports(res.data || []))
      .catch((err) => console.error('Failed to load consultation reports:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchReports();
  }, [appointmentId]);

  return (
    <div className="teleconsult-reports-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <b style={{ fontSize: '0.88rem', color: 'var(--text-main)' }}>
          Shared Medical Reports ({reports.length})
        </b>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={fetchReports}
          style={{ fontSize: '0.78rem', padding: '3px 8px' }}
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '24px 10px', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ width: 20, height: 20, margin: '0 auto 8px' }} />
          <small>Loading reports for this consultation...</small>
        </div>
      ) : reports.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '28px 12px', color: 'var(--text-muted)', background: '#f8fafc', borderRadius: 8 }}>
          <FileText size={32} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
          <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>No reports shared for this consultation</div>
          <small style={{ fontSize: '0.76rem', color: '#64748b' }}>
            {user?.role === 'PATIENT'
              ? 'You can upload reports from your My Medical Reports dashboard.'
              : 'Patient has not shared any reports for this appointment.'}
          </small>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
          {reports.map((r) => {
            const catMeta = getCategoryMeta(r.category);
            return (
              <div
                key={r.id}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: 8,
                  padding: '10px 12px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <b style={{ fontSize: '0.88rem', color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 170 }}>
                      {r.title}
                    </b>
                    <span
                      style={{
                        background: catMeta.bg,
                        color: catMeta.color,
                        padding: '1px 6px',
                        borderRadius: 8,
                        fontSize: '0.68rem',
                        fontWeight: 700
                      }}
                    >
                      {catMeta.label}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    📅 {r.report_date?.slice(0, 10)} · {formatFileSize(r.file_size)}
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setPreviewReport(r)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', fontSize: '0.76rem', fontWeight: 700, flexShrink: 0 }}
                >
                  <Eye size={13} />
                  <span>View</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Embedded Document Preview Modal */}
      {previewReport && (
        <DocumentPreviewModal
          reportId={previewReport.id}
          report={previewReport}
          onClose={() => setPreviewReport(null)}
        />
      )}
    </div>
  );
}
