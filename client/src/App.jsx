import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  HeartPulse,
  Activity,
  Users,
  Calendar,
  Clock,
  Video,
  FileText,
  Pill,
  MapPin,
  User,
  LogOut,
  PlusCircle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Mic,
  MicOff,
  VideoOff,
  PhoneOff,
  PhoneCall,
  Send,
  Search,
  Bell,
  Stethoscope,
  ClipboardList,
  Home as HomeIcon,
  Phone,
  ShieldAlert,
  ChevronRight,
  Info,
  Bot,
  Sparkles,
  Trash2,
  ExternalLink,
  AlertTriangle,
  Printer,
  RefreshCw,
  Lock,
  Edit3,
  Eye,
  Square,
  QrCode,
  CreditCard,
  IndianRupee,
  ShieldCheck,
  Upload
} from 'lucide-react';
import QRCode from 'qrcode';
import { useLanguage, LanguageSelector, SUPPORTED_LANGUAGES } from './translations.js';
import {
  PatientMedicalReportsView,
  DoctorPatientReportsView,
  HealthWorkerPatientReportsView,
  TeleconsultationReportsPanel,
  DocumentPreviewModal,
  PatientDashboardReportsSection,
  DoctorDashboardReportsSection,
  HealthWorkerDashboardReportsSection,
  UploadMedicalReportModal
} from './MedicalReports.jsx';

export const getApiBaseUrl = () => {
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:5000/api';
    }
    return `${window.location.origin}/api`;
  }
  return 'http://localhost:5000/api';
};

export const getWebSocketUrl = () => {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  if (import.meta.env.VITE_API_BASE_URL) {
    try {
      const parsed = new URL(import.meta.env.VITE_API_BASE_URL, window.location.href);
      const wsProto = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${wsProto}//${parsed.host}/ws`;
    } catch (e) {}
  }
  if (typeof window !== 'undefined') {
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return `${wsProto}//${window.location.hostname}:5000/ws`;
    }
    return `${wsProto}//${window.location.host}/ws`;
  }
  return 'ws://localhost:5000/ws';
};

const apiBase = getApiBaseUrl();
const api = axios.create({ baseURL: apiBase });


api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const getErrorMessage = (err) => err.response?.data?.error || err.message || 'Something went wrong';
const LANGUAGES = ['English', 'Tamil', 'Hindi', 'Telugu', 'Malayalam', 'Kannada'];

// ==========================================
// AUTHENTICATION COMPONENT
// ==========================================
// ==========================================
// ROLE SELECTION & AUTHENTICATION COMPONENT
// ==========================================
function AuthView({ onLogin }) {
  const { t } = useLanguage();
  // mode: 'hub' (3-role cards) or 'form' (login/register form for chosen role)
  const [mode, setMode] = useState('hub');
  const [selectedRole, setSelectedRole] = useState('PATIENT'); // 'PATIENT' | 'DOCTOR' | 'HEALTH_WORKER'
  const [isRegister, setIsRegister] = useState(false);

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    gender: 'Other',
    dob: '',
    address: '',
    language: 'English',
    // Patient specific
    emergency_contact_name: '',
    emergency_contact_phone: '',
    // Doctor specific
    specialization: 'General Medicine',
    qualification: 'MBBS, MD',
    experience: '5',
    start_time: '09:00',
    end_time: '17:00',
    slot_duration_mins: 30,
    available_days: 'Mon,Tue,Wed,Thu,Fri,Sat',
    consultation_fee: 500,
    bio: '',
    // Health Worker specific
    assigned_area: 'Zone A - Primary Health Center',
    employee_id: ''
  });

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value });
  };

  const handleSelectRole = (role, authType = 'login') => {
    setSelectedRole(role);
    setIsRegister(authType === 'register');
    setError('');
    setMode('form');
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const endpoint = isRegister ? '/auth/register' : '/auth/login';
      const payload = isRegister
        ? { ...form, role: selectedRole }
        : { email: form.email, password: form.password, expected_role: selectedRole };

      const { data } = await api.post(endpoint, payload);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      onLogin(data.user);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async (email, role) => {
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', {
        email,
        password: 'Password@123',
        expected_role: role
      });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      onLogin(data.user);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // 1. ROLE SELECTION HUB (3 CARDS)
  if (mode === 'hub') {
    return (
      <div className="auth-container">
        <div className="role-hub-container">
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <LanguageSelector />
          </div>
          <div className="auth-header" style={{ textAlign: 'center', marginBottom: 28 }}>
            <div className="brand" style={{ justifyContent: 'center', marginBottom: 12 }}>
              <div className="brand-icon" style={{ width: 44, height: 44 }}>
                <HeartPulse size={26} />
              </div>
              <span style={{ fontSize: '1.65rem' }}>MediConnect AI</span>
            </div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: 6 }}>
              {t('portal_title', 'Healthcare & Telemedicine Portal')}
            </h2>
            <p className="page-subtitle" style={{ fontSize: '1rem', maxWidth: 650, margin: '0 auto' }}>
              Select your portal role below to access personalized healthcare tools, clinical records, and video consultations
            </p>
            <span className="academic-badge" style={{ marginTop: 10, display: 'inline-block' }}>
              Academic demonstration platform – not a substitute for professional emergency medical care
            </span>
          </div>

          {error && (
            <div className="alert alert-danger" style={{ maxWidth: 800, margin: '0 auto 20px auto' }}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* 3 ROLE CARDS */}
          <div className="role-cards-grid">
            {/* Card 1: Patient */}
            <div className="role-portal-card PATIENT">
              <div>
                <div className="role-icon-box PATIENT">
                  <HeartPulse size={28} />
                </div>
                <h3 style={{ fontSize: '1.35rem', marginBottom: 6 }}>Patient Portal</h3>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                  Personalized care for individuals and families seeking medical consultations and wellness tracking.
                </p>

                <ul className="role-feature-list">
                  <li><CheckCircle2 size={16} /> Book specialist doctor appointments</li>
                  <li><CheckCircle2 size={16} /> Live WebRTC video teleconsultations</li>
                  <li><CheckCircle2 size={16} /> Digital prescriptions & instructions</li>
                  <li><CheckCircle2 size={16} /> Daily medicine tracker & dose logs</li>
                  <li><CheckCircle2 size={16} /> AI symptom triage & hospital locator</li>
                </ul>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%' }}
                  onClick={() => handleSelectRole('PATIENT', 'login')}
                >
                  Patient Sign In
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ width: '100%' }}
                  onClick={() => handleSelectRole('PATIENT', 'register')}
                >
                  Register as Patient
                </button>
              </div>
            </div>

            {/* Card 2: Doctor */}
            <div className="role-portal-card DOCTOR">
              <div>
                <div className="role-icon-box DOCTOR">
                  <Stethoscope size={28} />
                </div>
                <h3 style={{ fontSize: '1.35rem', marginBottom: 6 }}>Doctor Portal</h3>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                  Dedicated workspace for licensed physicians, specialists, and clinical consultants.
                </p>

                <ul className="role-feature-list">
                  <li><CheckCircle2 size={16} /> Manage consultation requests & slots</li>
                  <li><CheckCircle2 size={16} /> Custom working hours & availability</li>
                  <li><CheckCircle2 size={16} /> Teleconsultation room & clinical notes</li>
                  <li><CheckCircle2 size={16} /> Digital prescription issuing tool</li>
                  <li><CheckCircle2 size={16} /> Patient history & appointment reviews</li>
                </ul>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
                <button
                  type="button"
                  className="btn btn-success"
                  style={{ width: '100%' }}
                  onClick={() => handleSelectRole('DOCTOR', 'login')}
                >
                  Doctor Sign In
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ width: '100%', borderColor: '#10b981', color: '#10b981', fontWeight: 700 }}
                  onClick={() => handleQuickDemo('priya@demo.com', 'DOCTOR')}
                >
                  ⚡ Try Demo (Doctor)
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ width: '100%' }}
                  onClick={() => handleSelectRole('DOCTOR', 'register')}
                >
                  Register as Doctor
                </button>
              </div>
            </div>

            {/* Card 3: Health Worker */}
            <div className="role-portal-card HEALTH_WORKER">
              <div>
                <div className="role-icon-box HEALTH_WORKER">
                  <ClipboardList size={28} />
                </div>
                <h3 style={{ fontSize: '1.35rem', marginBottom: 6 }}>Health Worker Portal</h3>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                  Field platform for community health facilitators, ANMs, and rural care workers.
                </p>

                <ul className="role-feature-list">
                  <li><CheckCircle2 size={16} /> Register community resident patients</li>
                  <li><CheckCircle2 size={16} /> Log home visits & vital signs (BP, Pulse, Sugar)</li>
                  <li><CheckCircle2 size={16} /> Patient observation & follow-up records</li>
                  <li><CheckCircle2 size={16} /> Medicine adherence compliance checks</li>
                  <li><CheckCircle2 size={16} /> Arrange appointments with doctors</li>
                </ul>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', background: '#d97706', borderColor: '#d97706' }}
                  onClick={() => handleSelectRole('HEALTH_WORKER', 'login')}
                >
                  Health Worker Sign In
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ width: '100%', borderColor: '#d97706', color: '#d97706', fontWeight: 700 }}
                  onClick={() => handleQuickDemo('hw1@demo.com', 'HEALTH_WORKER')}
                >
                  ⚡ Try Demo (Health Worker)
                </button>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ width: '100%' }}
                  onClick={() => handleSelectRole('HEALTH_WORKER', 'register')}
                >
                  Register as Health Worker
                </button>
              </div>
            </div>
          </div>

          {/* Quick Demo Logins Footer */}
          <div className="demo-credentials-box" style={{ maxWidth: 880, margin: '30px auto 0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <b>⚡ Instant Demo Access (Password: Password@123):</b>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Click any user below to test live</span>
            </div>
            <div className="demo-pills" style={{ marginTop: 10 }}>
              <button type="button" className="demo-pill-btn" onClick={() => handleQuickDemo('patient1@demo.com', 'PATIENT')}>
                🧑 Patient: Rajesh Kumar
              </button>
              <button type="button" className="demo-pill-btn" onClick={() => handleQuickDemo('patient2@demo.com', 'PATIENT')}>
                🧑 Patient: Ananya Sharma
              </button>
              <button type="button" className="demo-pill-btn" onClick={() => handleQuickDemo('priya@demo.com', 'DOCTOR')}>
                🩺 Doctor: Dr. Priya (Cardiology)
              </button>
              <button type="button" className="demo-pill-btn" onClick={() => handleQuickDemo('arun@demo.com', 'DOCTOR')}>
                🩺 Doctor: Dr. Arun (Medicine)
              </button>
              <button type="button" className="demo-pill-btn" onClick={() => handleQuickDemo('hw1@demo.com', 'HEALTH_WORKER')}>
                📋 Health Worker: Sarala Devi
              </button>
              <button type="button" className="demo-pill-btn" onClick={() => handleQuickDemo('hw2@demo.com', 'HEALTH_WORKER')}>
                📋 Health Worker: Malathi R
              </button>
              <button type="button" className="demo-pill-btn" onClick={() => handleQuickDemo('admin@demo.com', 'ADMIN')}>
                👑 Admin HQ
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. ROLE-SPECIFIC LOGIN OR REGISTRATION FORM
  const roleDisplayNames = {
    PATIENT: 'Patient',
    DOCTOR: 'Doctor',
    HEALTH_WORKER: 'Health Worker'
  };

  const SPECIALTIES_LIST = [
    'General Medicine',
    'Cardiology',
    'Pediatrics',
    'Dermatology',
    'Orthopedics',
    'Neurology',
    'Gynecology & Obstetrics',
    'ENT (Ear, Nose, Throat)',
    'Psychiatry',
    'Ophthalmology'
  ];

  return (
    <div className="auth-container">
      <div className="auth-card">
        {/* Back button and Language Selector */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={() => { setMode('hub'); setError(''); }}
          >
            ← {t('back', 'Back to All Roles')}
          </button>
          <LanguageSelector compact />
        </div>

        <div className="auth-header">
          <div className="brand" style={{ justifyContent: 'center', marginBottom: 10 }}>
            <div className="brand-icon">
              {selectedRole === 'DOCTOR' ? (
                <Stethoscope size={22} />
              ) : selectedRole === 'HEALTH_WORKER' ? (
                <ClipboardList size={22} />
              ) : (
                <HeartPulse size={22} />
              )}
            </div>
            <span>MediConnect AI</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 }}>
            <span className={`role-pill ${selectedRole}`}>{roleDisplayNames[selectedRole]} Portal</span>
          </div>
          <p className="page-subtitle" style={{ marginTop: 6 }}>
            {isRegister
              ? `Register as a new ${roleDisplayNames[selectedRole]}`
              : `Sign in to access your ${roleDisplayNames[selectedRole]} dashboard`}
          </p>
        </div>

        {/* Tab switcher: Sign In vs Register */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${!isRegister ? 'active' : ''}`}
            onClick={() => { setIsRegister(false); setError(''); }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab ${isRegister ? 'active' : ''}`}
            onClick={() => { setIsRegister(true); setError(''); }}
          >
            Register as {roleDisplayNames[selectedRole]}
          </button>
        </div>

        {error && (
          <div className="alert alert-danger">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleAuth}>
          {/* ================= REGISTER FIELDS ================= */}
          {isRegister && (
            <>
              {/* Common basic fields */}
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  className="form-input"
                  required
                  placeholder={selectedRole === 'DOCTOR' ? 'e.g. Dr. Kavitha Rajan' : 'e.g. Ramesh Kumar'}
                  value={form.name}
                  onChange={handleChange('name')}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Phone Number *</label>
                  <input
                    className="form-input"
                    required
                    placeholder="e.g. 9840123456"
                    value={form.phone}
                    onChange={handleChange('phone')}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <select className="form-select" value={form.gender} onChange={handleChange('gender')}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              {/* ================= PATIENT-SPECIFIC FIELDS ================= */}
              {selectedRole === 'PATIENT' && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Date of Birth</label>
                      <input
                        type="date"
                        className="form-input"
                        value={form.dob}
                        onChange={handleChange('dob')}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Preferred Language</label>
                      <select className="form-select" value={form.language} onChange={handleChange('language')}>
                        {LANGUAGES.map((l) => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Address</label>
                    <input
                      className="form-input"
                      placeholder="e.g. 14 Gandhi Road, Erode"
                      value={form.address}
                      onChange={handleChange('address')}
                    />
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Emergency Contact Name</label>
                      <input
                        className="form-input"
                        placeholder="e.g. Family member / Spouse"
                        value={form.emergency_contact_name}
                        onChange={handleChange('emergency_contact_name')}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Emergency Contact Phone</label>
                      <input
                        className="form-input"
                        placeholder="e.g. 9840123459"
                        value={form.emergency_contact_phone}
                        onChange={handleChange('emergency_contact_phone')}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* ================= DOCTOR-SPECIFIC FIELDS ================= */}
              {selectedRole === 'DOCTOR' && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Medical Specialization *</label>
                      <select
                        className="form-select"
                        value={form.specialization}
                        onChange={handleChange('specialization')}
                        required
                      >
                        {SPECIALTIES_LIST.map((sp) => (
                          <option key={sp} value={sp}>{sp}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Medical Qualification *</label>
                      <input
                        className="form-input"
                        required
                        placeholder="e.g. MBBS, MD (Cardio)"
                        value={form.qualification}
                        onChange={handleChange('qualification')}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Years of Experience</label>
                      <input
                        type="number"
                        min="0"
                        max="50"
                        className="form-input"
                        value={form.experience}
                        onChange={handleChange('experience')}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Consultation Fee (₹)</label>
                      <input
                        type="number"
                        min="0"
                        className="form-input"
                        value={form.consultation_fee}
                        onChange={handleChange('consultation_fee')}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Daily Available Start Time</label>
                      <input
                        type="time"
                        className="form-input"
                        value={form.start_time}
                        onChange={handleChange('start_time')}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Daily Available End Time</label>
                      <input
                        type="time"
                        className="form-input"
                        value={form.end_time}
                        onChange={handleChange('end_time')}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Professional Bio / Clinical Summary</label>
                    <textarea
                      className="form-textarea"
                      rows="2"
                      placeholder="e.g. Specializing in outpatient cardiology and preventive cardiovascular health."
                      value={form.bio}
                      onChange={handleChange('bio')}
                    />
                  </div>
                </>
              )}

              {/* ================= HEALTH WORKER-SPECIFIC FIELDS ================= */}
              {selectedRole === 'HEALTH_WORKER' && (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Assigned Community Area / Zone *</label>
                      <input
                        className="form-input"
                        required
                        placeholder="e.g. Zone A - Perundurai Rural"
                        value={form.assigned_area}
                        onChange={handleChange('assigned_area')}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Employee / Badge ID</label>
                      <input
                        className="form-input"
                        placeholder="e.g. HW-205"
                        value={form.employee_id}
                        onChange={handleChange('employee_id')}
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Qualification / Role</label>
                      <select
                        className="form-select"
                        value={form.qualification}
                        onChange={handleChange('qualification')}
                      >
                        <option value="Certified Auxiliary Nurse Midwife (ANM)">Auxiliary Nurse Midwife (ANM)</option>
                        <option value="Senior ASHA Facilitator">ASHA Facilitator</option>
                        <option value="Community Health Officer (CHO)">Community Health Officer (CHO)</option>
                        <option value="Primary Healthcare Volunteer">Primary Healthcare Volunteer</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Preferred Language</label>
                      <select className="form-select" value={form.language} onChange={handleChange('language')}>
                        {LANGUAGES.map((l) => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {/* Common Account Credentials */}
          <div className="form-group">
            <label className="form-label">Email Address *</label>
            <input
              type="email"
              className="form-input"
              required
              placeholder="user@example.com"
              value={form.email}
              onChange={handleChange('email')}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password *</label>
            <input
              type="password"
              className="form-input"
              required
              placeholder={isRegister ? 'Min 8 chars with a number' : 'Your password'}
              value={form.password}
              onChange={handleChange('password')}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{
              width: '100%',
              marginTop: 10,
              background: selectedRole === 'DOCTOR' ? '#10b981' : selectedRole === 'HEALTH_WORKER' ? '#d97706' : '#0284c7',
              borderColor: selectedRole === 'DOCTOR' ? '#10b981' : selectedRole === 'HEALTH_WORKER' ? '#d97706' : '#0284c7'
            }}
            disabled={loading}
          >
            {loading ? 'Processing...' : isRegister ? `Create ${roleDisplayNames[selectedRole]} Account` : `${roleDisplayNames[selectedRole]} Sign In`}
          </button>

          {!isRegister && (
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px dashed var(--border)', textAlign: 'center' }}>
              {selectedRole === 'DOCTOR' && (
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ width: '100%', borderColor: '#10b981', color: '#10b981', fontWeight: 700 }}
                  onClick={() => handleQuickDemo('priya@demo.com', 'DOCTOR')}
                  disabled={loading}
                >
                  ⚡ Try Demo (Dr. Priya Sharma)
                </button>
              )}

              {selectedRole === 'HEALTH_WORKER' && (
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ width: '100%', borderColor: '#d97706', color: '#d97706', fontWeight: 700 }}
                  onClick={() => handleQuickDemo('hw1@demo.com', 'HEALTH_WORKER')}
                  disabled={loading}
                >
                  ⚡ Try Demo (Sarala Devi - Health Worker)
                </button>
              )}

              {selectedRole === 'PATIENT' && (
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ width: '100%', borderColor: '#0284c7', color: '#0284c7', fontWeight: 700 }}
                  onClick={() => handleQuickDemo('patient1@demo.com', 'PATIENT')}
                  disabled={loading}
                >
                  ⚡ Try Demo (Rajesh Kumar - Patient)
                </button>
              )}

              <small style={{ color: 'var(--text-muted)', display: 'block', marginTop: 6 }}>
                Click to authenticate directly with existing database demo credentials
              </small>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

// ==========================================
// 1. PATIENT DASHBOARD & SUBVIEWS
// ==========================================

function PatientHome({ user, onNavigate, onOpenOverdueModal }) {
  const [appointments, setAppointments] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [reportsCount, setReportsCount] = useState(0);
  const [doctors, setDoctors] = useState([]);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [reportsKey, setReportsKey] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = () => {
    Promise.all([
      api.get('/appointments').catch(() => ({ data: [] })),
      api.get('/reminders').catch(() => ({ data: [] })),
      api.get('/prescriptions').catch(() => ({ data: [] })),
      api.get('/medical-reports').catch(() => ({ data: [] })),
      api.get('/doctors').catch(() => ({ data: [] }))
    ])
      .then(([aRes, rRes, pRes, repRes, docRes]) => {
        setAppointments(Array.isArray(aRes.data) ? aRes.data : []);
        setReminders(Array.isArray(rRes.data) ? rRes.data : []);
        setPrescriptions(Array.isArray(pRes.data) ? pRes.data : []);
        setReportsCount(Array.isArray(repRes.data) ? repRes.data.length : 0);
        setDoctors(Array.isArray(docRes.data) ? docRes.data : []);
      })
      .catch((err) => console.error('Error loading dashboard data:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const upcomingApts = (Array.isArray(appointments) ? appointments : []).filter(
    (a) => a && ['Pending', 'Confirmed'].includes(a.status)
  );

  // Helper to detect overdue doses
  const isDoseOverdue = (rem) => {
    if (!rem || rem.status !== 'Active') return false;
    if (rem.today_status === 'Taken') return false;
    if (!rem.remind_time) return false;
    const now = new Date();
    const [h, m] = rem.remind_time.split(':').map(Number);
    const scheduled = new Date();
    scheduled.setHours(h, m, 0, 0);
    return now > scheduled;
  };

  const overdueCount = reminders.filter(isDoseOverdue).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Welcome back, {user.name}</h2>
          <p className="page-subtitle">Your personalized patient healthcare overview</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowUploadModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            <Upload size={16} /> Upload Medical Report
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => onNavigate('medical-reports')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            <FileText size={16} /> My Medical Reports
          </button>
          <button className="btn btn-outline" onClick={() => onNavigate('book-appointment')}>
            <PlusCircle size={16} /> Book Appointment
          </button>
        </div>
      </div>

      {/* Missed Medicine Time Banner */}
      {overdueCount > 0 && (
        <div
          className="alert alert-danger"
          style={{
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            padding: '14px 18px',
            borderLeft: '5px solid #dc2626',
            background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <AlertTriangle size={24} color="#dc2626" style={{ flexShrink: 0 }} />
            <div>
              <b style={{ color: '#b91c1c', fontSize: '0.98rem' }}>MEDICINE TIME MISSED! ({overdueCount} {overdueCount === 1 ? 'dose' : 'doses'} overdue)</b>
              <div style={{ fontSize: '0.86rem', color: '#7f1d1d', marginTop: 2 }}>
                Your scheduled dose time has passed. Please confirm your medicine status immediately.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {onOpenOverdueModal && (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                style={{ fontWeight: 800 }}
                onClick={onOpenOverdueModal}
              >
                Confirm Dose Status
              </button>
            )}
            <button
              type="button"
              className="btn btn-outline btn-sm"
              style={{ fontWeight: 600, borderColor: '#f87171', color: '#991b1b' }}
              onClick={() => onNavigate('medicine-tracker')}
            >
              Medicine Tracker
            </button>
          </div>
        </div>
      )}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon blue">
            <Calendar size={24} />
          </div>
          <div>
            <div className="stat-value">{upcomingApts.length}</div>
            <div className="stat-label">Upcoming Appointments</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <Pill size={24} />
          </div>
          <div>
            <div className="stat-value">
              {reminders.length}
              {overdueCount > 0 && (
                <span style={{ fontSize: '0.78rem', color: '#dc2626', marginLeft: 8, fontWeight: 700 }}>
                  ({overdueCount} Overdue)
                </span>
              )}
            </div>
            <div className="stat-label">Daily Dose Reminders</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon teal">
            <FileText size={24} />
          </div>
          <div>
            <div className="stat-value">{prescriptions.length}</div>
            <div className="stat-label">Active Prescriptions</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple">
            <FileText size={24} />
          </div>
          <div>
            <div className="stat-value">{reportsCount}</div>
            <div className="stat-label">Medical Reports</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        {/* Upcoming appointments card */}
        <div className="card">
          <div className="card-title">
            <span>Upcoming Consultations</span>
            <button className="btn btn-outline btn-sm" onClick={() => onNavigate('my-appointments')}>
              View All
            </button>
          </div>

          {upcomingApts.length === 0 ? (
            <div className="empty-state">
              <Calendar size={36} />
              <p>No upcoming appointments scheduled.</p>
              <button
                className="btn btn-primary btn-sm"
                style={{ marginTop: 10 }}
                onClick={() => onNavigate('book-appointment')}
              >
                Book with a Doctor
              </button>
            </div>
          ) : (
            upcomingApts.slice(0, 3).map((apt) => (
              <div
                key={apt.id}
                style={{
                  padding: '12px 14px',
                  background: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: 10,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <b>{apt.doctor_name}</b> <small>({apt.specialization})</small>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    📅 {apt.date.slice(0, 10)} at ⏰ {apt.time.slice(0, 5)}
                  </div>
                </div>
                <div>
                  <span className={`badge badge-${apt.status}`}>{apt.status}</span>
                  {apt.status === 'Confirmed' && (
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ marginLeft: 8 }}
                      onClick={() => onNavigate('teleconsultation', { appointmentId: apt.id })}
                    >
                      <Video size={14} /> Join
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Medicine reminders card */}
        <div className="card">
          <div className="card-title">
            <span>Today's Medicine Schedule</span>
            <button className="btn btn-outline btn-sm" onClick={() => onNavigate('medicine-tracker')}>
              Medicine Tracker
            </button>
          </div>

          {reminders.length === 0 ? (
            <div className="empty-state">
              <Pill size={36} />
              <p>No active medicine reminders.</p>
            </div>
          ) : (
            reminders.slice(0, 4).map((rem) => {
              const isTaken = rem.today_status === 'Taken';
              const overdue = isDoseOverdue(rem);
              return (
                <div
                  key={rem.id}
                  style={{
                    padding: '12px 14px',
                    background: overdue ? '#fef2f2' : 'var(--bg-subtle)',
                    border: overdue ? '1px solid #fecaca' : 'none',
                    borderRadius: 'var(--radius-sm)',
                    marginBottom: 10,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <b>{rem.medicine_name}</b> <small>({rem.dosage})</small>
                    <div style={{ fontSize: '0.82rem', color: overdue ? '#991b1b' : 'var(--text-muted)' }}>
                      ⏰ Scheduled at {rem.remind_time.slice(0, 5)} · {rem.instructions}
                    </div>
                  </div>
                  <span
                    className={`badge badge-${isTaken ? 'Confirmed' : overdue ? 'Cancelled' : 'Pending'}`}
                    style={overdue ? { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5' } : {}}
                  >
                    {isTaken ? '✓ Taken' : overdue ? '⚠️ Overdue' : 'Pending Dose'}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Prominent My Medical Reports Section on Patient Dashboard */}
      <div style={{ marginTop: 24 }}>
        <PatientDashboardReportsSection
          key={reportsKey}
          user={user}
          onNavigate={onNavigate}
        />
      </div>

      {showUploadModal && (
        <UploadMedicalReportModal
          doctors={doctors}
          onClose={() => setShowUploadModal(false)}
          onUploaded={() => {
            loadDashboardData();
            setReportsKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

// AI Health Support & Conversational Assistant
function AIHealthSupportView({ onNavigate }) {
  const { language, t } = useLanguage();
  const [query, setQuery] = useState('');
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [showSymptoms, setShowSymptoms] = useState(true);
  const chatEndRef = useRef(null);

  // Voice Input (Speech Recognition) State & Handlers
  const [isListening, setIsListening] = useState(false);
  const [speechError, setSpeechError] = useState('');
  const recognitionRef = useRef(null);
  const baseQueryRef = useRef('');

  const SpeechRecognition = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;
  const isSpeechSupported = !!SpeechRecognition;

  const SPEECH_LANG_MAP = {
    English: 'en-US',
    Tamil: 'ta-IN',
    Hindi: 'hi-IN',
    Telugu: 'te-IN',
    Malayalam: 'ml-IN',
    Kannada: 'kn-IN'
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }
    };
  }, []);

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    setIsListening(false);
  };

  const startListening = () => {
    if (!isSpeechSupported) {
      setSpeechError('Speech recognition is not supported in this browser. Please use Google Chrome, Microsoft Edge, or Safari.');
      return;
    }

    setSpeechError('');

    try {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {}
      }

      const recognition = new SpeechRecognition();
      const targetLang = SPEECH_LANG_MAP[language] || (language === 'Tamil' ? 'ta-IN' : 'en-US');
      recognition.lang = targetLang;
      recognition.continuous = true;
      recognition.interimResults = true;

      baseQueryRef.current = query;
      let finalTranscript = '';

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError('');
      };

      recognition.onresult = (event) => {
        let interim = '';
        let currentFinal = '';

        for (let i = 0; i < event.results.length; i++) {
          const item = event.results[i];
          if (item.isFinal) {
            currentFinal += item[0].transcript + ' ';
          } else {
            interim += item[0].transcript;
          }
        }

        finalTranscript = currentFinal;
        const spoken = (finalTranscript + interim).trim();
        const base = baseQueryRef.current ? baseQueryRef.current.trim() : '';

        if (spoken) {
          setQuery(base ? `${base} ${spoken}` : spoken);
        }
      };

      recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setSpeechError('Microphone permission denied. Please allow microphone access in your browser settings.');
        } else if (event.error === 'no-speech') {
          setSpeechError('No speech detected. Please speak into the microphone.');
        } else if (event.error === 'network') {
          setSpeechError('Network error encountered during speech recognition.');
        } else if (event.error !== 'aborted') {
          setSpeechError(`Speech recognition notice: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('Error starting speech recognition:', err);
      setSpeechError('Unable to access microphone. Please check your microphone permissions.');
      setIsListening(false);
    }
  };

  const toggleListening = () => {
    if (!isSpeechSupported) {
      setSpeechError('Speech recognition is not supported in this browser. Please use Google Chrome, Microsoft Edge, or Safari.');
      return;
    }
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const SYMPTOM_OPTIONS = [
    'Mild Fever',
    'Headache',
    'Chest Pain (Urgent)',
    'Shortness of Breath',
    'Cough & Cold',
    'Dehydration / Thirst',
    'Stomach Pain',
    'High Blood Sugar',
    'Nausea / Vomiting',
    'Fatigue',
    'Skin Rash',
    'Joint Pain'
  ];

  const QUICK_PROMPTS = [
    'Why might I have a headache and mild fever?',
    'Which doctor should I consult for a skin rash?',
    'What does high blood pressure mean?',
    'I have chest pain and severe difficulty breathing. What should I do?',
    'What is the difference between a general physician and a cardiologist?'
  ];

  const [messages, setMessages] = useState([
    {
      id: 'welcome-msg',
      sender: 'assistant',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      data: {
        isEmergency: false,
        title: 'MediConnect AI Healthcare Assistant',
        answer: 'Hello! I am your AI clinical assistant. You can ask me any health questions in plain English or Tamil, describe your symptoms, or seek guidance on preventive care.',
        details: [
          '**Natural Language Queries:** Type any symptom or medical question in the box below.',
          '**Specialist Recommendations:** I will suggest appropriate clinical specialties and show available doctors in our hospital portal.',
          '**Emergency Triage:** Immediate guidance with national emergency numbers (112 / 108) for urgent conditions.',
          '**Tamil & English:** Bilingual support for clinical doubts and general healthcare questions.'
        ],
        nextSteps: 'Select symptom tags above or describe how you feel in the text area below to get started.',
        source: 'local'
      }
    }
  ]);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const loadHistory = () => {
    api.get('/ai/history')
      .then((res) => setHistory(res.data))
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const toggleSymptom = (sym) => {
    if (selectedSymptoms.includes(sym)) {
      setSelectedSymptoms(selectedSymptoms.filter((s) => s !== sym));
    } else {
      setSelectedSymptoms([...selectedSymptoms, sym]);
    }
  };

  const handleClearChat = () => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      setIsListening(false);
    }
    setSpeechError('');
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        data: {
          isEmergency: false,
          title: 'Chat Reset',
          answer: 'Conversation cleared. How can I help you today? Please describe your symptoms or ask any health-related question.',
          details: [],
          nextSteps: 'Type your question or choose a suggested prompt below.'
        }
      }
    ]);
    setSelectedSymptoms([]);
    setQuery('');
    setError('');
  };

  const handleSendMessage = async (textToSend, symptomsToSend) => {
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      setIsListening(false);
    }
    const qText = (textToSend !== undefined ? textToSend : query).trim();
    const syms = symptomsToSend !== undefined ? symptomsToSend : selectedSymptoms;

    if (!qText && syms.length === 0) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: qText,
      symptoms: [...syms],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    setQuery('');
    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/ai/chat', {
        symptoms: syms.join(', '),
        query: qText,
        language: language
      });

      const assistantMsg = {
        id: `assistant-${Date.now()}`,
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        data: data
      };

      setMessages((prev) => [...prev, assistantMsg]);
      loadHistory();
    } catch (err) {
      const errMsg = getErrorMessage(err);
      setError(errMsg);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          sender: 'assistant',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          data: {
            isEmergency: false,
            title: 'Unable to Process Query',
            answer: `An error occurred: ${errMsg}. Please ensure the server is connected, or try again.`,
            details: ['Check your internet connection', 'Verify server connectivity', 'Try rephrasing your question'],
            nextSteps: 'Please try sending your question again.'
          }
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleSendMessage();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handlePromptClick = (prompt) => {
    handleSendMessage(prompt, selectedSymptoms);
  };

  // Helper to format text with **bold** markers
  const renderFormattedText = (text) => {
    if (!text || typeof text !== 'string') return text;
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bot size={28} color="var(--primary)" />
            AI Health Support & Triage
          </h2>
          <p className="page-subtitle">
            Intelligent AI clinical triage, evidence-based health guidance, and verified doctor recommendations
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowHistory(!showHistory)}
            title="View query history"
          >
            <Clock size={16} /> {showHistory ? 'Hide History' : 'History'} ({history.length})
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleClearChat}
            title="Start fresh conversation"
          >
            <Trash2 size={16} /> Clear Chat
          </button>
        </div>
      </div>

      {/* Prominent Medical Disclaimer */}
      <div className="alert alert-warning" style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <ShieldAlert size={22} style={{ flexShrink: 0, marginTop: 2 }} />
        <div style={{ fontSize: '0.88rem', lineHeight: 1.5 }}>
          <b>Important Clinical Disclaimer:</b> MediConnect AI guidance is strictly educational and informational. It does <b>not</b> constitute a formal medical diagnosis or prescription. Never disregard professional clinical advice or delay seeking care because of something you read here. In a life-threatening emergency, call <b>112</b> or <b>108</b> immediately.
        </div>
      </div>

      {/* History Panel (collapsible) */}
      {showHistory && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Recent AI Health Consultations ({history.length})</span>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setShowHistory(false)}
            >
              Close
            </button>
          </div>
          {history.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No past consultations found.</p>
          ) : (
            <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {history.map((h) => {
                let parsedResponse = null;
                try {
                  parsedResponse = JSON.parse(h.response);
                } catch {
                  // Legacy string response
                }
                return (
                  <div
                    key={h.id}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      padding: 12,
                      background: 'var(--bg-subtle)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, color: 'var(--primary)', fontSize: '0.9rem' }}>
                        {h.symptoms ? `[Symptoms: ${h.symptoms}] ` : ''}{h.query || 'Symptom Consultation'}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {new Date(h.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.5 }}>
                      {parsedResponse ? parsedResponse.answer : (h.response ? h.response.slice(0, 200) + '...' : '')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Symptom Quick Selection Panel */}
      <div className="card" style={{ marginBottom: 16, padding: '16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Sparkles size={16} color="var(--primary)" />
            <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>Quick Symptom Selector (Optional)</span>
            {selectedSymptoms.length > 0 && (
              <span className="badge badge-Completed" style={{ fontSize: '0.75rem' }}>
                {selectedSymptoms.length} selected
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {selectedSymptoms.length > 0 && (
              <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={() => setSelectedSymptoms([])}
                style={{ fontSize: '0.78rem', padding: '4px 10px' }}
              >
                Clear Selected
              </button>
            )}
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => setShowSymptoms(!showSymptoms)}
              style={{ fontSize: '0.78rem', padding: '4px 10px' }}
            >
              {showSymptoms ? 'Hide Symptoms' : 'Show Symptoms'}
            </button>
          </div>
        </div>

        {showSymptoms && (
          <div className="symptom-tag-cloud" style={{ marginTop: 6 }}>
            {SYMPTOM_OPTIONS.map((sym) => {
              const isSelected = selectedSymptoms.includes(sym);
              const isUrgent = sym.includes('Urgent');
              return (
                <button
                  key={sym}
                  type="button"
                  className={`symptom-chip ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleSymptom(sym)}
                  style={isUrgent && !isSelected ? { borderColor: 'var(--danger)', color: 'var(--danger)' } : {}}
                >
                  {isSelected ? '✓ ' : '+ '} {sym}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Conversational Assistant Card */}
      <div className="ai-assistant-card">
        {/* Top bar */}
        <div className="ai-chat-topbar">
          <div className="ai-status-indicator">
            <div className="ai-status-dot" />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                MediConnect AI Clinical Assistant
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Active Session • Context-Aware Clinical Triage • English & Tamil
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                fontSize: '0.75rem',
                padding: '4px 10px',
                borderRadius: 'var(--radius-full)',
                background: 'rgba(2, 132, 199, 0.1)',
                color: 'var(--primary)',
                fontWeight: 600
              }}
            >
              🇮🇳 Emergency: 112 / 108
            </span>
          </div>
        </div>

        {/* Messages Stream */}
        <div className="ai-chat-messages">
          {messages.map((msg) => {
            if (msg.sender === 'user') {
              return (
                <div key={msg.id} className="ai-msg-row user">
                  <div className="ai-avatar user">
                    <User size={18} />
                  </div>
                  <div>
                    <div className="ai-bubble-user">
                      {msg.symptoms && msg.symptoms.length > 0 && (
                        <div style={{ marginBottom: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {msg.symptoms.map((s) => (
                            <span
                              key={s}
                              style={{
                                background: 'rgba(255, 255, 255, 0.25)',
                                padding: '2px 8px',
                                borderRadius: 12,
                                fontSize: '0.75rem',
                                fontWeight: 600
                              }}
                            >
                              🏷️ {s}
                            </span>
                          ))}
                        </div>
                      )}
                      <div>{msg.text || 'Evaluate these symptoms'}</div>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-light)', marginTop: 4, textAlign: 'right' }}>
                      {msg.timestamp}
                    </div>
                  </div>
                </div>
              );
            }

            // Assistant Message
            const d = msg.data || {};
            const isEmergency = d.isEmergency;

            return (
              <div key={msg.id} className="ai-msg-row assistant">
                <div className="ai-avatar assistant">
                  <Bot size={20} />
                </div>
                <div className="ai-bubble-assistant">
                  {/* Emergency Banner */}
                  {isEmergency && (
                    <div className="ai-emergency-box">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#dc2626', fontWeight: 800, fontSize: '1.05rem' }}>
                        <AlertTriangle size={24} />
                        <span>CRITICAL MEDICAL EMERGENCY DETECTED</span>
                      </div>
                      <p style={{ marginTop: 6, fontSize: '0.92rem', color: '#991b1b', lineHeight: 1.5 }}>
                        The symptoms described indicate a potentially life-threatening emergency. <b>Do not wait for a routine appointment.</b> Seek emergency medical evaluation immediately.
                      </p>
                      <div className="ai-emergency-phones">
                        <a href="tel:112" className="ai-emergency-btn">
                          <Phone size={16} /> Dial 112 (National Emergency)
                        </a>
                        <a href="tel:108" className="ai-emergency-btn" style={{ background: '#b91c1c' }}>
                          <Phone size={16} /> Dial 108 (Ambulance Service)
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Title */}
                  {d.title && (
                    <div className="ai-response-title">
                      {isEmergency ? <AlertCircle color="var(--danger)" size={20} /> : <CheckCircle2 color="var(--teal)" size={20} />}
                      <span>{d.title}</span>
                    </div>
                  )}

                  {/* Direct Answer */}
                  {d.answer && (
                    <div className="ai-response-answer">
                      {renderFormattedText(d.answer)}
                    </div>
                  )}

                  {/* Details / Bullets */}
                  {d.details && d.details.length > 0 && (
                    <div className="ai-details-list">
                      {d.details.map((detail, idx) => (
                        <div key={idx} className="ai-detail-item">
                          • {renderFormattedText(detail)}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Next Steps / Warning signs */}
                  {d.nextSteps && (
                    <div className="ai-nextsteps-box">
                      <b>📌 Recommended Action & Warning Signs:</b>
                      <div style={{ marginTop: 4 }}>{renderFormattedText(d.nextSteps)}</div>
                    </div>
                  )}

                  {/* Follow-up question if any */}
                  {d.followUpQuestion && (
                    <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', padding: '10px 14px', borderRadius: 'var(--radius-sm)', marginTop: 10, fontSize: '0.88rem', color: '#475569' }}>
                      💬 <b>Clarification:</b> {d.followUpQuestion}
                    </div>
                  )}

                  {/* Recommended Specialty */}
                  {d.specialty && !isEmergency && (
                    <div className="ai-specialty-card">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Stethoscope size={18} color="var(--primary)" />
                          <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.95rem' }}>
                            Recommended Specialty: {d.specialty}
                          </span>
                        </div>
                        {onNavigate && (
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            onClick={() => onNavigate('find-doctor')}
                            style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                          >
                            <Search size={14} /> Find a Doctor
                          </button>
                        )}
                      </div>
                      {d.specialtyReason && (
                        <div style={{ fontSize: '0.86rem', color: '#475569', marginTop: 6, lineHeight: 1.4 }}>
                          {d.specialtyReason}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Matching Doctors from Database */}
                  {!isEmergency && d.doctors && d.doctors.length > 0 && (
                    <div className="ai-doctor-recommendations">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Users size={16} color="var(--primary)" />
                          Verified In-Network Specialists ({d.doctors.length})
                        </div>
                        {onNavigate && (
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ fontSize: '0.78rem', padding: '2px 8px', color: 'var(--primary)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                            onClick={() => onNavigate('find-doctor')}
                          >
                            View all specialists →
                          </button>
                        )}
                      </div>

                      <div className="ai-doctor-grid">
                        {d.doctors.map((doc) => (
                          <div key={doc.id} className="ai-doc-mini-card">
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                <div
                                  style={{
                                    width: 40,
                                    height: 40,
                                    borderRadius: 10,
                                    background: 'var(--primary-light)',
                                    color: 'var(--primary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 800,
                                    fontSize: '1rem'
                                  }}
                                >
                                  {doc.name.replace('Dr. ', '').charAt(0)}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontWeight: 700, fontSize: '0.92rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {doc.name}
                                  </div>
                                  <span className="badge badge-Completed" style={{ fontSize: '0.72rem', padding: '2px 6px' }}>
                                    {doc.specialization}
                                  </span>
                                </div>
                              </div>

                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 10 }}>
                                <div>🎓 {doc.qualification} • {doc.experience} yrs exp</div>
                                <div>⏰ {doc.start_time ? doc.start_time.slice(0, 5) : '09:00'} - {doc.end_time ? doc.end_time.slice(0, 5) : '17:00'}</div>
                                <div>📅 {doc.available_days || 'Mon-Sat'}</div>
                                <div>💳 Consultation: ₹{doc.consultation_fee || 500}</div>
                              </div>
                            </div>

                            {onNavigate && (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                style={{ width: '100%', marginTop: 6, fontSize: '0.82rem', padding: '6px 12px' }}
                                onClick={() => onNavigate('book-appointment', { doctorId: doc.id })}
                              >
                                <Calendar size={14} /> Book Appointment
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* If specialty recommended but no doctors in DB */}
                  {!isEmergency && d.specialty && (!d.doctors || d.doctors.length === 0) && (
                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px dashed var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '12px 16px',
                        marginTop: 14,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 10
                      }}
                    >
                      <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                        ℹ️ No registered <b>{d.specialty}</b> doctors currently found in the portal. You can consult an external {d.specialty} specialist or check all available doctors.
                      </div>
                      {onNavigate && (
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={() => onNavigate('find-doctor')}
                          style={{ fontSize: '0.8rem' }}
                        >
                          <Search size={14} /> View All Doctors
                        </button>
                      )}
                    </div>
                  )}

                  {/* Footer metadata */}
                  <div className="ai-footer-note">
                    <span>
                      {d.source === 'gemini' && '⚡ Powered by Google Gemini AI'}
                      {d.source === 'openai' && '⚡ Powered by OpenAI'}
                      {d.source === 'local' && (d.noApiKey ? '📚 Built-in Medical Engine (API key optional)' : '📚 Clinical Knowledge Base')}
                    </span>
                    <span>{msg.timestamp}</span>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Loading Indicator */}
          {loading && (
            <div className="ai-msg-row assistant">
              <div className="ai-avatar assistant">
                <Bot size={20} />
              </div>
              <div className="ai-typing-indicator">
                <div className="ai-typing-dots">
                  <span />
                  <span />
                  <span />
                </div>
                <span>MediConnect AI is evaluating your symptoms & matching specialists...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Bar & Quick Prompts */}
        <div className="ai-chat-input-wrapper">
          {/* Quick prompt chips */}
          <div className="ai-quick-prompts-bar">
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', alignSelf: 'center', whiteSpace: 'nowrap', marginRight: 4 }}>
              Try asking:
            </span>
            {QUICK_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                type="button"
                className="ai-prompt-chip"
                onClick={() => handlePromptClick(prompt)}
                disabled={loading}
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Active Voice Listening Banner */}
          {isListening && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 'var(--radius-sm)',
                padding: '6px 12px',
                marginBottom: 10,
                fontSize: '0.82rem',
                color: '#b91c1c',
                fontWeight: 600
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#dc2626',
                  display: 'inline-block',
                  boxShadow: '0 0 6px #dc2626'
                }}
              />
              <span>Listening in {language}... Speak clearly into your microphone. Click Stop or Send when finished.</span>
              <button
                type="button"
                onClick={stopListening}
                className="btn btn-sm"
                style={{
                  marginLeft: 'auto',
                  padding: '2px 8px',
                  fontSize: '0.75rem',
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer'
                }}
              >
                Stop
              </button>
            </div>
          )}

          {/* Voice Input Notice / Error Banner */}
          {speechError && (
            <div
              className="alert alert-danger"
              style={{
                marginBottom: 10,
                padding: '8px 12px',
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8
              }}
            >
              <span>{speechError}</span>
              <button
                type="button"
                onClick={() => setSpeechError('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'inherit',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  padding: '0 4px'
                }}
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          )}

          {error && <div className="alert alert-danger" style={{ marginBottom: 10 }}>{error}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <textarea
                className="form-textarea"
                rows="2"
                style={{ resize: 'none', paddingRight: 14, marginBottom: 0 }}
                placeholder={
                  isListening
                    ? `Listening in ${language}... speak now`
                    : selectedSymptoms.length > 0
                    ? `Symptoms selected: [${selectedSymptoms.join(', ')}]. Add more details or press Enter...`
                    : "Describe your symptoms or ask any health question (e.g., 'Why do I have a persistent cough?', 'உடல் சோர்வு'). Press Enter to send."
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
              />
            </div>

            {/* Voice Input (Microphone) Button */}
            <button
              type="button"
              className={`btn ${isListening ? 'btn-danger' : 'btn-secondary'}`}
              onClick={toggleListening}
              disabled={loading}
              style={{
                height: 58,
                minWidth: 54,
                padding: '0 10px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.2s ease',
                ...(isListening
                  ? {
                      background: '#dc2626',
                      borderColor: '#b91c1c',
                      color: '#ffffff',
                      boxShadow: '0 0 0 3px rgba(220, 38, 38, 0.25)'
                    }
                  : !isSpeechSupported
                  ? {
                      opacity: 0.6,
                      cursor: 'not-allowed'
                    }
                  : {})
              }}
              title={
                !isSpeechSupported
                  ? 'Microphone Unavailable (Browser does not support Speech Recognition)'
                  : isListening
                  ? 'Stop Recording'
                  : `Speak Message (${language})`
              }
              aria-label={
                !isSpeechSupported
                  ? 'Microphone Unavailable'
                  : isListening
                  ? 'Stop Recording'
                  : 'Speak Message'
              }
            >
              {!isSpeechSupported ? (
                <MicOff size={20} color="var(--text-muted)" />
              ) : isListening ? (
                <Square size={18} fill="currentColor" />
              ) : (
                <Mic size={20} color="var(--primary)" />
              )}
              <span
                style={{
                  fontSize: '0.64rem',
                  fontWeight: 700,
                  marginTop: 2,
                  letterSpacing: '0.2px',
                  whiteSpace: 'nowrap'
                }}
              >
                {!isSpeechSupported ? 'Unavail' : isListening ? 'Stop' : 'Speak'}
              </span>
            </button>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || (!query.trim() && selectedSymptoms.length === 0)}
              style={{
                height: 58,
                padding: '0 20px',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontWeight: 700
              }}
            >
              {loading ? (
                <>Analyzing...</>
              ) : (
                <>
                  <Send size={18} />
                  <span>Send</span>
                </>
              )}
            </button>
          </form>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, fontSize: '0.76rem', color: 'var(--text-muted)' }}>
            <span>Press <b>Enter</b> to send, <b>Shift + Enter</b> for new line</span>
            <span>MediConnect AI Triage • Always consult a physician for official medical care</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Find a Doctor & Book Appointment
function FindDoctorView({ onSelectDoctorToBook }) {
  const [doctors, setDoctors] = useState([]);
  const [search, setSearch] = useState('');
  const [spec, setSpec] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchDoctors = () => {
    setLoading(true);
    api.get(`/doctors?search=${encodeURIComponent(search)}&spec=${encodeURIComponent(spec)}`)
      .then((res) => setDoctors(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDoctors();
  }, [search, spec]);

  const SPECIALTIES = ['Cardiology', 'General Medicine', 'Pediatrics'];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Find a Doctor</h2>
          <p className="page-subtitle">Connect with certified specialists and schedule consultations</p>
        </div>
      </div>

      <div className="card" style={{ padding: '16px 20px' }}>
        <div className="form-row">
          <div className="form-group" style={{ margin: 0 }}>
            <input
              className="form-input"
              placeholder="Search by doctor name or specialty..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <select className="form-select" value={spec} onChange={(e) => setSpec(e.target.value)}>
              <option value="">All Specializations</option>
              {SPECIALTIES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <p>Loading doctors...</p>
      ) : doctors.length === 0 ? (
        <div className="empty-state">
          <Stethoscope size={40} />
          <p>No doctors found matching your criteria.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 20 }}>
          {doctors.map((doc) => (
            <div key={doc.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 14,
                      background: 'var(--primary-light)',
                      color: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      fontSize: '1.2rem'
                    }}
                  >
                    {doc.name.replace('Dr. ', '').charAt(0)}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.1rem' }}>{doc.name}</h3>
                    <span className="badge badge-Completed">{doc.specialization}</span>
                  </div>
                </div>

                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
                  <div>🎓 <b>Qualification:</b> {doc.qualification}</div>
                  <div>💼 <b>Experience:</b> {doc.experience} years</div>
                  <div>⏰ <b>Working Hours:</b> {doc.start_time.slice(0, 5)} - {doc.end_time.slice(0, 5)}</div>
                  <div>📅 <b>Available Days:</b> {doc.available_days || 'Mon-Sat'}</div>
                  <div>💳 <b>Consultation Fee:</b> ₹{doc.consultation_fee || 500}</div>
                  {doc.bio && <div style={{ marginTop: 8, fontStyle: 'italic' }}>"{doc.bio}"</div>}
                </div>
              </div>

              <button
                className="btn btn-primary"
                style={{ width: '100%', marginTop: 10 }}
                onClick={() => onSelectDoctorToBook(doc.id)}
              >
                <Calendar size={16} /> Book Appointment
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Dedicated Book Appointment View
function BookAppointmentView({ preselectedDoctorId, onAppointmentBooked }) {
  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState(preselectedDoctorId || '');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [reason, setReason] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get('/doctors').then((res) => {
      setDoctors(res.data);
      if (!doctorId && res.data.length > 0) {
        setDoctorId(res.data[0].id);
      }
    });
  }, []);

  // Calculate future minimum date (tomorrow or today)
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  useEffect(() => {
    if (!doctorId || !date) {
      setAvailableSlots([]);
      return;
    }
    setLoadingSlots(true);
    api.get(`/doctors/${doctorId}?date=${date}`)
      .then((res) => {
        const { doctor, bookedSlots } = res.data;
        if (!doctor) return;

        // Generate time slots based on doctor's hours
        const startH = parseInt(doctor.start_time.slice(0, 2), 10);
        const endH = parseInt(doctor.end_time.slice(0, 2), 10);
        const slots = [];

        for (let h = startH; h < endH; h++) {
          const hh = h.toString().padStart(2, '0');
          const slot1 = `${hh}:00`;
          const slot2 = `${hh}:30`;
          if (!bookedSlots.includes(slot1)) slots.push(slot1);
          if (!bookedSlots.includes(slot2)) slots.push(slot2);
        }
        setAvailableSlots(slots);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoadingSlots(false));
  }, [doctorId, date]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!doctorId || !date || !time) {
      setError('Please select a doctor, date, and available time slot.');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post('/appointments', {
        doctor_id: doctorId,
        date,
        time,
        reason: reason.trim() || 'General Consultation'
      });
      setSuccess('Appointment successfully booked! The doctor will review and confirm.');
      setTime('');
      setReason('');
      if (onAppointmentBooked) onAppointmentBooked(data.id);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Book an Appointment</h2>
          <p className="page-subtitle">Select your doctor, preferred date, and available consultation slot</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 650 }}>
        {error && (
          <div className="alert alert-danger">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="alert alert-success">
            <CheckCircle2 size={18} />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Select Doctor *</label>
            <select
              className="form-select"
              value={doctorId}
              onChange={(e) => { setDoctorId(e.target.value); setTime(''); }}
              required
            >
              <option value="">-- Choose Doctor --</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.specialization}) · {d.start_time.slice(0, 5)} - {d.end_time.slice(0, 5)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Appointment Date *</label>
            <input
              type="date"
              className="form-input"
              min={tomorrowStr}
              value={date}
              onChange={(e) => { setDate(e.target.value); setTime(''); }}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Available Time Slot *</label>
            {!date ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Please choose a date above to check available doctor slots.
              </p>
            ) : loadingSlots ? (
              <p style={{ fontSize: '0.85rem' }}>Checking doctor availability...</p>
            ) : availableSlots.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--danger)' }}>
                No available slots on this date. Doctor may be fully booked or off duty.
              </p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                {availableSlots.map((slot) => (
                  <button
                    key={slot}
                    type="button"
                    className={`btn ${time === slot ? 'btn-primary' : 'btn-outline'} btn-sm`}
                    onClick={() => setTime(slot)}
                  >
                    ⏰ {slot}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Reason for Consultation</label>
            <textarea
              className="form-textarea"
              rows="3"
              placeholder="e.g. Regular hypertension follow-up or checkup for fever..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 10 }}
            disabled={submitting || !time}
          >
            {submitting ? 'Confirming Booking...' : 'Confirm Appointment Booking'}
          </button>
        </form>
      </div>
    </div>
  );
}

// My Appointments View
function MyAppointmentsView({ user, onJoinTeleconsult }) {
  const [appointments, setAppointments] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');

  const loadAppointments = () => {
    setLoading(true);
    api.get('/appointments')
      .then((res) => setAppointments(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAppointments();
  }, []);

  const handleCancel = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;
    try {
      await api.delete(`/appointments/${id}`);
      setActionMsg('Appointment cancelled successfully.');
      loadAppointments();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const filtered = appointments.filter((a) => {
    if (filter === 'ALL') return true;
    return a.status === filter;
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">My Appointments</h2>
          <p className="page-subtitle">Track, reschedule, or cancel your scheduled medical consultations</p>
        </div>
      </div>

      {actionMsg && (
        <div className="alert alert-info">
          <Info size={18} />
          <span>{actionMsg}</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {['ALL', 'Pending', 'Confirmed', 'Completed', 'Cancelled'].map((st) => (
          <button
            key={st}
            className={`btn btn-sm ${filter === st ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(st)}
          >
            {st} ({appointments.filter((a) => st === 'ALL' || a.status === st).length})
          </button>
        ))}
      </div>

      {loading ? (
        <p>Loading appointments...</p>
      ) : filtered.length === 0 ? (
        <div className="empty-state card">
          <Calendar size={40} />
          <p>No appointments found under "{filter}".</p>
        </div>
      ) : (
        <div className="table-responsive card" style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Doctor</th>
                <th>Specialization</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((apt) => (
                <tr key={apt.id}>
                  <td>
                    <b>{apt.date.slice(0, 10)}</b>
                    <br />
                    <small>⏰ {apt.time.slice(0, 5)}</small>
                  </td>
                  <td>{apt.doctor_name}</td>
                  <td>{apt.specialization}</td>
                  <td>{apt.reason || 'General Checkup'}</td>
                  <td>
                    <span className={`badge badge-${apt.status}`}>{apt.status}</span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {['Pending', 'Confirmed'].includes(apt.status) && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleCancel(apt.id)}
                        >
                          Cancel
                        </button>
                      )}
                      {['Confirmed', 'In Progress', 'Waiting for Doctor', 'Waiting for Patient'].includes(apt.status) && (
                        <>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => onJoinTeleconsult(apt.id, 'video')}
                            title="Join Video Call"
                          >
                            <Video size={14} /> Video
                          </button>
                          <button
                            className="btn btn-sm"
                            style={{ background: '#7c3aed', color: '#fff', borderColor: '#7c3aed' }}
                            onClick={() => onJoinTeleconsult(apt.id, 'audio')}
                            title="Join Voice Call"
                          >
                            <PhoneCall size={14} /> Voice
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ==========================================
// ==========================================
// CONSULTATION PAYMENT QR COMPONENT (DIRECT GOOGLE PAY UPI)
// ==========================================
function ConsultationPaymentQR({ appointmentId, session, user, patientName, doctorName }) {
  const [upiConfig, setUpiConfig] = useState({
    upiPayeeId: '',
    upiPayeeName: 'MediConnect AI',
    amount: '500.00',
    currency: 'INR',
    transactionNote: 'MediConnect AI Consultation Fee',
    isConfigured: false
  });
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [upiUri, setUpiUri] = useState('');
  const [showEnlargeModal, setShowEnlargeModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editUpiId, setEditUpiId] = useState('');
  const [editUpiName, setEditUpiName] = useState('MediConnect AI');
  const [saving, setSaving] = useState(false);
  const [configMsg, setConfigMsg] = useState('');
  const [configErr, setConfigErr] = useState('');
  const [copied, setCopied] = useState(false);

  // Load UPI payee configuration from backend
  const loadUpiConfig = async () => {
    try {
      const res = await api.get('/config/upi');
      setUpiConfig(res.data);
      if (res.data.upiPayeeId) {
        setEditUpiId(res.data.upiPayeeId);
      }
      if (res.data.upiPayeeName) {
        setEditUpiName(res.data.upiPayeeName);
      }
    } catch (err) {
      console.warn('Failed to load UPI config', err);
    }
  };

  useEffect(() => {
    loadUpiConfig();
  }, []);

  // Generate UPI URI & QR Code whenever upiConfig or appointmentId changes
  useEffect(() => {
    if (!upiConfig.isConfigured || !upiConfig.upiPayeeId) {
      setQrDataUrl('');
      setUpiUri('');
      return;
    }

    const payeeId = upiConfig.upiPayeeId.trim();
    const payeeName = (upiConfig.upiPayeeName || 'MediConnect AI').trim();
    const txRef = `MC-APT-${appointmentId || 'LIVE'}-${Date.now().toString().slice(-6)}`;
    const note = 'MediConnect AI Consultation Fee';

    // Standard NPCI / Google Pay UPI URI specification
    const uri = `upi://pay?pa=${encodeURIComponent(payeeId)}&pn=${encodeURIComponent(payeeName)}&am=500.00&cu=INR&tn=${encodeURIComponent(note)}&tr=${encodeURIComponent(txRef)}`;
    setUpiUri(uri);

    QRCode.toDataURL(uri, {
      width: 240,
      margin: 1,
      color: { dark: '#0f172a', light: '#ffffff' }
    })
      .then((dataUrl) => setQrDataUrl(dataUrl))
      .catch((err) => console.error('Failed to generate UPI QR code', err));
  }, [upiConfig, appointmentId]);

  // Handle saving UPI ID via setup modal
  const handleSaveUpiConfig = async (e) => {
    e.preventDefault();
    setConfigMsg('');
    setConfigErr('');
    if (!editUpiId || !editUpiId.includes('@')) {
      setConfigErr('Please enter a valid UPI ID with "@" (e.g., clinic@okhdfcbank or doctor@okaxis).');
      return;
    }

    setSaving(true);
    try {
      const res = await api.post('/config/upi', {
        upiPayeeId: editUpiId.trim(),
        upiPayeeName: editUpiName.trim() || 'MediConnect AI'
      });
      setConfigMsg('Google Pay UPI ID configured successfully!');
      setUpiConfig({
        ...upiConfig,
        upiPayeeId: res.data.upiPayeeId,
        upiPayeeName: res.data.upiPayeeName,
        isConfigured: true
      });
      setTimeout(() => setShowConfigModal(false), 1200);
    } catch (err) {
      setConfigErr(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleCopyUpi = () => {
    if (!upiUri) return;
    navigator.clipboard?.writeText(upiUri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`consultation-payment-panel ${!upiConfig.isConfigured ? 'unconfigured' : ''}`}>
      {/* CASE 1: UPI ID IS NOT CONFIGURED -> Show clear setup notice (per prompt specification) */}
      {!upiConfig.isConfigured ? (
        <>
          <div className="payment-setup-icon">
            <AlertTriangle size={24} color="#d97706" />
          </div>
          <div className="payment-qr-info">
            <div className="payment-qr-title-row">
              <span className="payment-fee-text">Consultation Fee: ₹500</span>
              <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>Setup Required</span>
            </div>
            <div className="payment-scan-instruction" style={{ color: '#b45309' }}>
              UPI ID not configured for Google Pay
            </div>
            <div className="payment-qr-actions">
              <button
                type="button"
                className="btn btn-primary btn-xs"
                onClick={() => { setConfigErr(''); setConfigMsg(''); setShowConfigModal(true); }}
                title="Configure Payee UPI ID for Google Pay payments"
              >
                ⚙️ Configure UPI ID
              </button>
            </div>
          </div>
        </>
      ) : (
        /* CASE 2: UPI ID IS CONFIGURED -> Show live Google Pay QR code & required text */
        <>
          {/* Small Google Pay QR Thumbnail */}
          <div
            className="payment-qr-thumb"
            onClick={() => setShowEnlargeModal(true)}
            title="Click to enlarge Google Pay payment QR code"
          >
            {qrDataUrl ? (
              <img src={qrDataUrl} alt="Google Pay Consultation Fee ₹500 QR Code" />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                <QrCode size={28} />
              </div>
            )}
          </div>

          {/* Required Texts: Consultation Fee: ₹500 & Scan using Google Pay */}
          <div className="payment-qr-info">
            <div className="payment-qr-title-row">
              <span className="payment-fee-text">Consultation Fee: ₹500</span>
              <span className="badge badge-warning payment-status-badge" style={{ fontSize: '0.65rem', padding: '2px 6px' }}>
                Pending
              </span>
            </div>
            <div className="payment-scan-instruction" style={{ fontWeight: 700, color: '#0f172a' }}>
              Scan using Google Pay • Scan to view payment details
            </div>
            <div className="payment-qr-subtext" title={`${upiConfig.upiPayeeName} (${upiConfig.upiPayeeId})`}>
              Payee: {upiConfig.upiPayeeName} ({upiConfig.upiPayeeId})
            </div>
            <div className="payment-qr-actions">
              <button
                type="button"
                className="btn btn-outline btn-xs"
                onClick={() => setShowEnlargeModal(true)}
                title="Enlarge QR code for patient to scan"
              >
                <QrCode size={12} /> Enlarge QR
              </button>
              <button
                type="button"
                className="btn btn-outline btn-xs"
                onClick={() => { setConfigErr(''); setConfigMsg(''); setShowConfigModal(true); }}
                title="Change Payee UPI ID or Name"
              >
                ⚙️ UPI Settings
              </button>
            </div>
          </div>
        </>
      )}

      {/* Enlarged Google Pay QR Modal */}
      {showEnlargeModal && upiConfig.isConfigured && (
        <div className="modal-backdrop" onClick={() => setShowEnlargeModal(false)}>
          <div className="modal-content payment-enlarge-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <QrCode size={20} color="var(--primary)" />
                <span>Google Pay Consultation Payment</span>
              </div>
              <button className="btn-close" onClick={() => setShowEnlargeModal(false)}>×</button>
            </div>

            <div style={{ textAlign: 'center', padding: '18px 20px' }}>
              <div className="payment-modal-fee-banner">
                <span className="fee-label">Consultation Fee:</span>
                <span className="fee-amount">₹500.00</span>
                <span className="badge badge-warning" style={{ marginLeft: 8 }}>Pending</span>
              </div>

              {/* Direct UPI QR Code Frame */}
              <div className="payment-modal-qr-frame">
                {qrDataUrl && (
                  <img
                    src={qrDataUrl}
                    alt="Google Pay UPI QR Code ₹500"
                    style={{ width: 230, height: 230, display: 'block' }}
                  />
                )}
              </div>

              <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a', marginTop: 14, marginBottom: 4 }}>
                Scan using Google Pay
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.4 }}>
                Open <b>Google Pay</b> on your mobile phone → Tap <b>Scan any QR code</b> → Scan this code.<br />
                Recipient and pre-filled <b>₹500.00</b> will appear on your Google Pay screen.
              </p>

              {/* Verified Payee Details Box */}
              <div style={{ background: 'var(--bg-subtle)', padding: '10px 14px', borderRadius: 8, fontSize: '0.82rem', textAlign: 'left', marginBottom: 14 }}>
                <div>🏦 <b>Payee Name:</b> {upiConfig.upiPayeeName}</div>
                <div>🆔 <b>Payee UPI ID:</b> <code style={{ fontWeight: 700 }}>{upiConfig.upiPayeeId}</code></div>
                <div>📝 <b>Note:</b> MediConnect AI Consultation Fee</div>
                <div>💰 <b>Fixed Amount:</b> ₹500.00 INR</div>
                {appointmentId && <div>📋 <b>Consultation Ref:</b> #{appointmentId}</div>}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                <a
                  href={upiUri}
                  className="btn btn-primary btn-sm"
                  title="Open in Google Pay or default UPI app"
                >
                  📱 Pay with Google Pay App
                </a>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleCopyUpi}
                >
                  {copied ? '✓ Copied URI' : 'Copy UPI String'}
                </button>
              </div>

              {/* Compliance & Safety Notice */}
              <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 14, lineHeight: 1.4 }}>
                🔒 <b>Safety:</b> Payment is authorized securely in your Google Pay app with your bank UPI PIN. Consultation call and notes remain active.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* UPI Configuration Modal */}
      {showConfigModal && (
        <div className="modal-backdrop" onClick={() => setShowConfigModal(false)}>
          <div className="modal-content" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Configure Google Pay UPI Payee</div>
              <button className="btn-close" onClick={() => setShowConfigModal(false)}>×</button>
            </div>

            <form onSubmit={handleSaveUpiConfig} style={{ padding: '18px 20px' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 14 }}>
                Set your clinical or healthcare organization's UPI Virtual Payment Address (VPA). Google Pay will direct ₹500 consultation payments to this recipient.
              </p>

              {configMsg && <div className="alert alert-success" style={{ marginBottom: 12 }}>{configMsg}</div>}
              {configErr && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{configErr}</div>}

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>
                  Payee UPI ID (VPA) *
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. dr.priya@okhdfcbank or clinic@okaxis"
                  value={editUpiId}
                  onChange={(e) => setEditUpiId(e.target.value)}
                  required
                />
                <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: 4, display: 'block' }}>
                  Must be a valid UPI handle containing "@" (e.g. @okhdfcbank, @okaxis, @oksbi).
                </small>
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label" style={{ fontWeight: 700 }}>
                  Payee Display Name
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. MediConnect AI or Dr. Priya Clinic"
                  value={editUpiName}
                  onChange={(e) => setEditUpiName(e.target.value)}
                />
              </div>

              <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: 6, fontSize: '0.78rem', color: '#475569', marginBottom: 16 }}>
                ℹ️ <b>Environment Variable:</b> You can also configure this permanently in <code>server/.env</code> by setting <code>UPI_PAYEE_ID=yourname@bank</code>.
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowConfigModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving || !editUpiId}
                >
                  {saving ? 'Saving...' : 'Save & Activate Google Pay QR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// CONSULTATION PAYMENT INFO PAGE (MOBILE-FRIENDLY)
// ==========================================
function ConsultationPaymentInfoPage() {
  const [loading, setLoading] = useState(true);
  const [details, setDetails] = useState(null);

  const searchParams = new URLSearchParams(window.location.search);
  const aptId = searchParams.get('appointmentId') || searchParams.get('apt') || '0';

  useEffect(() => {
    api.get(`/consultations/${aptId}/payment-info`)
      .then((res) => setDetails(res.data))
      .catch(() => {
        setDetails({
          appointmentId: aptId !== '0' ? aptId : null,
          patientName: 'Teleconsultation Patient',
          doctorName: 'Dr. MediConnect Specialist',
          specialization: 'General Medicine & Telehealth',
          hospitalName: 'MediConnect AI Healthcare Network',
          date: new Date().toISOString().slice(0, 10),
          time: 'Live Consultation',
          consultationType: 'Video',
          fee: 500,
          paymentStatus: 'Pending',
          isDemo: true
        });
      })
      .finally(() => setLoading(false));
  }, [aptId]);

  const handleBackToApp = () => {
    window.location.href = '/';
  };

  return (
    <div className="payment-page-container">
      <div className="payment-page-card">
        {/* Top Branding */}
        <div className="payment-page-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, background: '#0284c7', color: '#fff', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <HeartPulse size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#0f172a' }}>MediConnect AI</div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Academic Healthcare Demo</div>
            </div>
          </div>
          <span className="badge badge-warning" style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
            Demo Mode
          </span>
        </div>

        {/* Required Header: MediConnect AI Consultation Payment */}
        <div className="payment-page-header">
          <div style={{ display: 'inline-flex', padding: 10, borderRadius: '50%', background: '#e0f2fe', color: '#0284c7', marginBottom: 8 }}>
            <CreditCard size={28} />
          </div>
          <h1 className="payment-page-title">MediConnect AI Consultation Payment</h1>
          <p className="payment-page-subtitle">Verified Consultation Fee Information</p>
        </div>

        {/* Required Amount Display: Amount: ₹500 */}
        <div className="payment-amount-box">
          <div className="payment-amount-label">Amount: ₹500</div>
          <div className="payment-amount-sub">Fixed Teleconsultation Service Fee</div>
        </div>

        {/* Consultation details */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
            <p>Loading consultation payment details...</p>
          </div>
        ) : (
          <div className="payment-details-table">
            <div className="detail-row">
              <span className="detail-key">Doctor:</span>
              <span className="detail-val"><b>{details?.doctorName || 'Dr. MediConnect Specialist'}</b> ({details?.specialization || 'Clinical Specialist'})</span>
            </div>
            <div className="detail-row">
              <span className="detail-key">Patient:</span>
              <span className="detail-val"><b>{details?.patientName || 'Consultation Patient'}</b></span>
            </div>
            <div className="detail-row">
              <span className="detail-key">Healthcare Network:</span>
              <span className="detail-val">{details?.hospitalName || 'MediConnect AI Healthcare Network'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-key">Consultation Type:</span>
              <span className="detail-val">{details?.consultationType || 'Video'} Teleconsultation</span>
            </div>
            <div className="detail-row">
              <span className="detail-key">Date & Time:</span>
              <span className="detail-val">{details?.date} • {details?.time}</span>
            </div>
            {details?.appointmentId && (
              <div className="detail-row">
                <span className="detail-key">Appointment Ref:</span>
                <span className="detail-val">#{details.appointmentId}</span>
              </div>
            )}
            <div className="detail-row" style={{ borderTop: '2px dashed #cbd5e1', paddingTop: 10, marginTop: 10 }}>
              <span className="detail-key" style={{ fontWeight: 700, color: '#0f172a' }}>Total Consultation Fee:</span>
              <span className="detail-val" style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0284c7' }}>₹500</span>
            </div>
          </div>
        )}

        {/* Required Safety & Demo Disclaimer */}
        <div className="payment-demo-disclaimer">
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <ShieldCheck size={20} color="#b45309" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 2 }}>
                Demo Payment Details Only
              </div>
              <div style={{ fontSize: '0.8rem', color: '#78350f', lineHeight: 1.45 }}>
                This page displays payment details only. Actual payment processing has not been configured in this demonstration system. No real funds are collected. MediConnect AI will never ask for your UPI PIN, banking password, or payment OTP.
              </div>
            </div>
          </div>
        </div>

        {/* Required Payment Instructions */}
        <div className="payment-instructions-card">
          <div style={{ fontWeight: 700, fontSize: '0.85rem', color: '#0f172a', marginBottom: 6 }}>
            Payment Instructions:
          </div>
          <ol style={{ paddingLeft: 18, margin: 0, fontSize: '0.82rem', color: '#475569', lineHeight: 1.5 }}>
            <li>Verify the consultation details and ₹500 fee displayed above.</li>
            <li>In production, secure payments are processed through RBI-approved gateways.</li>
            <li>For community health outreach or in-person clinics, coordinate payment settlement with your attending healthcare worker.</li>
          </ol>
        </div>

        {/* Required Back option */}
        <div style={{ marginTop: 24 }}>
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', fontSize: '0.95rem', fontWeight: 700 }}
            onClick={handleBackToApp}
          >
            ← Back to MediConnect AI
          </button>
        </div>
      </div>
    </div>
  );
}

// Teleconsultation View (Genuine WebRTC/MediaStream & In-call Chat)
function TeleconsultationView({ appointmentId, user, onEndCall, initialMode }) {
  // --- Ref-based WebRTC (fixes closure bugs) ---
  const pcRef = useRef(null);
  const wsRef = useRef(null);
  const localStreamRef = useRef(null);
  const iceQueueRef = useRef([]);
  const remoteDescSetRef = useRef(false);

  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [remoteVideoOff, setRemoteVideoOff] = useState(false);
  const [remoteAudioMuted, setRemoteAudioMuted] = useState(false);
  const [peers, setPeers] = useState([]);
  const [callEnded, setCallEnded] = useState(false);
  const remoteVideoRef = useRef(null);
  const localPipRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const iceConfig = {
    iceServers: (() => {
      if (import.meta.env.VITE_ICE_SERVERS) {
        try {
          return JSON.parse(import.meta.env.VITE_ICE_SERVERS);
        } catch (e) {
          console.warn('Failed to parse VITE_ICE_SERVERS JSON, using default STUN');
        }
      }
      return [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ];
    })()
  };

  const [aptList, setAptList] = useState([]);
  const [selectedId, setSelectedId] = useState(appointmentId ? Number(appointmentId) : null);
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatText, setChatText] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [mediaActive, setMediaActive] = useState(false);
  const [mediaError, setMediaError] = useState('');
  const [callMode, setCallMode] = useState(initialMode || 'video'); // 'video' | 'audio'
  const [callDuration, setCallDuration] = useState(0);
  const [panelTab, setPanelTab] = useState('chat'); // 'chat' | 'reports'
  const callTimerRef = useRef(null);

  // Duration timer: active only after user has joined consultation
  useEffect(() => {
    if (mediaActive) {
      callTimerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
    } else {
      clearInterval(callTimerRef.current);
    }
    return () => clearInterval(callTimerRef.current);
  }, [mediaActive]);

  const formatDuration = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  // Fetch confirmed/active appointments for the authenticated user
  useEffect(() => {
    api.get('/appointments').then((res) => {
      const activeOnes = res.data.filter((a) =>
        ['Confirmed', 'In Progress', 'Waiting for Doctor', 'Waiting for Patient'].includes(a.status)
      );
      setAptList(activeOnes);
      if (!selectedId && activeOnes.length > 0) {
        setSelectedId(activeOnes[0].id);
      }
    }).catch((err) => console.error('Error fetching appointments:', err));
  }, []);

  // Fetch session details and poll messages when appointment selected
  useEffect(() => {
    if (!selectedId) return;
    api.get(`/consultations/${selectedId}/session`)
      .then((res) => setSession(res.data))
      .catch((err) => console.error('Error fetching session details:', err));

    const fetchMsgs = () => {
      api.get(`/consultations/${selectedId}/messages`)
        .then((res) => setMessages(res.data))
        .catch((err) => console.error('Error fetching messages:', err));
    };
    fetchMsgs();
    const timer = setInterval(fetchMsgs, 3000);
    return () => clearInterval(timer);
  }, [selectedId]);

  // Keep video srcObjects attached and in sync with state
  useEffect(() => {
    if (localPipRef.current && localStream) {
      localPipRef.current.srcObject = localStream;
    }
  }, [localStream, mediaActive, isVideoOff]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream, remoteVideoOff]);

  // Drain queued ICE candidates after remote desc is set
  const drainIceQueue = async () => {
    const pc = pcRef.current;
    if (!pc || !remoteDescSetRef.current || !pc.remoteDescription) return;
    while (iceQueueRef.current.length > 0) {
      const candidate = iceQueueRef.current.shift();
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (e) {
        console.warn('ICE drain error', e);
      }
    }
  };

  // Helper: initiate WebRTC offer using ref (no closure bug)
  const initiateOffer = async () => {
    const pc = pcRef.current;
    const ws = wsRef.current;
    if (!pc || !ws || ws.readyState !== WebSocket.OPEN) return;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      ws.send(JSON.stringify({ type: 'signal', signalData: { sdp: pc.localDescription } }));
    } catch (e) {
      console.error('Offer creation failed', e);
    }
  };

  // Handle incoming signaling data (uses refs, no stale closure)
  const handleSignal = async (data) => {
    const pc = pcRef.current;
    const ws = wsRef.current;
    if (!pc || !ws) return;
    try {
      if (data.sdp) {
        const desc = new RTCSessionDescription(data.sdp);
        if (desc.type === 'offer') {
          if (pc.signalingState !== 'stable') {
            await Promise.all([
              pc.setLocalDescription({ type: 'rollback' }).catch(() => {}),
              pc.setRemoteDescription(desc)
            ]);
          } else {
            await pc.setRemoteDescription(desc);
          }
          remoteDescSetRef.current = true;
          await drainIceQueue();
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'signal', signalData: { sdp: pc.localDescription } }));
          }
        } else if (desc.type === 'answer') {
          if (pc.signalingState === 'have-local-offer') {
            await pc.setRemoteDescription(desc);
            remoteDescSetRef.current = true;
            await drainIceQueue();
          }
        }
      } else if (data.candidate) {
        if (remoteDescSetRef.current && pc.remoteDescription) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (e) {
            console.warn('ICE candidate error', e);
          }
        } else {
          iceQueueRef.current.push(data.candidate);
        }
      }
    } catch (err) {
      console.warn('Error handling WebRTC signal:', err);
    }
  };

  // Start camera/mic or audio-only ONLY when user clicks Join Call
  const startCamera = async () => {
    if (!selectedId) return;
    setMediaError('');
    remoteDescSetRef.current = false;
    iceQueueRef.current = [];

    let stream = null;
    const isAudioOnly = callMode === 'audio';

    try {
      stream = await navigator.mediaDevices.getUserMedia(
        isAudioOnly
          ? { audio: true, video: false }
          : { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true }
      );
    } catch (err) {
      console.warn('getUserMedia error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setMediaError('Camera / Microphone permission was denied. Please allow camera and microphone access in your browser settings to join.');
        return;
      }
      if (!isAudioOnly) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          setCallMode('audio');
          setMediaError('Camera not available or could not be opened. Switched to voice-only consultation mode.');
        } catch (err2) {
          if (err2.name === 'NotAllowedError' || err2.name === 'PermissionDeniedError') {
            setMediaError('Microphone permission was denied. Please allow microphone access in your browser settings.');
          } else {
            setMediaError('Neither camera nor microphone could be accessed on this device. Consultation running in chat-only mode.');
          }
          return;
        }
      } else {
        setMediaError('Microphone not accessible. Please check your audio input device.');
        return;
      }
    }

    localStreamRef.current = stream;
    setLocalStream(stream);

    // Attach local stream ONLY to local picture-in-picture preview
    if (localPipRef.current) {
      localPipRef.current.srcObject = stream;
    }

    // Create WebRTC peer connection
    const pc = new RTCPeerConnection(iceConfig);
    pcRef.current = pc;

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.addEventListener('track', (event) => {
      const [remote] = event.streams;
      if (remote) {
        setRemoteStream(remote);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = remote;
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remote;
      }
    });

    pc.addEventListener('icecandidate', (event) => {
      const ws = wsRef.current;
      if (event.candidate && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'signal', signalData: { candidate: event.candidate } }));
      }
    });

    pc.addEventListener('connectionstatechange', () => {
      if (pc.connectionState === 'connected') {
        api.put(`/appointments/${selectedId}/meeting`, { meeting_status: 'In Progress' }).catch(() => {});
      }
    });

    // Helper: determine if this user initiates the offer (Doctor or health worker first)
    const shouldInitiate = (myRole, currentPeers) => {
      if (myRole === 'DOCTOR') return true;
      if (myRole === 'ADMIN') return true;
      const hasDoctor = currentPeers.some((p) => p.role === 'DOCTOR');
      if (!hasDoctor && myRole === 'HEALTH_WORKER') return true;
      return false;
    };

    // Setup WebSocket signaling with JWT token & user identity
    const token = localStorage.getItem('token') || '';
    const socket = new WebSocket(getWebSocketUrl());
    wsRef.current = socket;

    socket.addEventListener('open', () => {
      socket.send(
        JSON.stringify({
          type: 'join',
          roomId: selectedId,
          user: { id: user.id, name: user.name, role: user.role },
          token
        })
      );
    });

    socket.addEventListener('message', async (event) => {
      try {
        const msg = JSON.parse(event.data);
        switch (msg.type) {
          case 'error':
            setMediaError(msg.message || 'Error connecting to consultation room.');
            break;
          case 'room-info':
            setPeers(msg.peers || []);
            if (msg.peers && msg.peers.length > 0 && shouldInitiate(user.role, msg.peers)) {
              await initiateOffer();
            }
            break;
          case 'peer-joined':
            setPeers((p) => [...p.filter((pr) => pr.id !== msg.peer.id), msg.peer]);
            if (shouldInitiate(user.role, [msg.peer])) {
              await initiateOffer();
            }
            break;
          case 'signal':
            await handleSignal(msg.signalData);
            break;
          case 'media-toggle':
            if (msg.mediaType === 'video') {
              setRemoteVideoOff(!msg.enabled);
            } else if (msg.mediaType === 'audio') {
              setRemoteAudioMuted(!msg.enabled);
            }
            break;
          case 'peer-left':
            setPeers((p) => p.filter((pr) => pr.id !== msg.peer?.id));
            setRemoteStream(null);
            if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
            break;
          case 'call-ended':
            setCallEnded(true);
            stopCamera();
            break;
          default:
            break;
        }
      } catch (e) {
        console.warn('Signaling parse error', e);
      }
    });

    // Mark meeting status
    const statusToSet = user.role === 'DOCTOR' ? 'Waiting for Patient' : 'Waiting for Doctor';
    api.put(`/appointments/${selectedId}/meeting`, { meeting_status: statusToSet }).catch(() => {});

    setMediaActive(true);
    setCallEnded(false);
    setCallDuration(0);
  };

  // Stop camera, microphone, WebSocket, and WebRTC peer connection completely
  const stopCamera = () => {
    // 1. Close WebSocket
    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.close();
        }
      } catch (e) {}
      wsRef.current = null;
    }

    // 2. Stop and release all local media tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch (e) {}
      });
      localStreamRef.current = null;
    }
    setLocalStream(null);

    // 3. Close RTCPeerConnection
    if (pcRef.current) {
      try {
        pcRef.current.close();
      } catch (e) {}
      pcRef.current = null;
    }

    // 4. Detach video srcObjects
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    if (localPipRef.current) localPipRef.current.srcObject = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;

    setRemoteStream(null);
    setPeers([]);
    setMediaActive(false);
    setIsMuted(false);
    setIsVideoOff(false);
    setRemoteVideoOff(false);
    setRemoteAudioMuted(false);
    remoteDescSetRef.current = false;
    iceQueueRef.current = [];
  };

  // Clean up media and connections on unmount or session switch
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [selectedId]);

  // Switch consultation session cleanly
  const handleSwitchSession = (newId) => {
    if (!newId || newId === selectedId) return;
    stopCamera();
    setSelectedId(Number(newId) || newId);
    setCallEnded(false);
    setMediaError('');
  };

  // Toggle user's own microphone
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        const nextState = !audioTracks[0].enabled;
        audioTracks.forEach((t) => {
          t.enabled = nextState;
        });
        setIsMuted(!nextState);
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'media-toggle',
              mediaType: 'audio',
              enabled: nextState
            })
          );
        }
      }
    }
  };

  // Toggle user's own camera
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        const nextState = !videoTracks[0].enabled;
        videoTracks.forEach((t) => {
          t.enabled = nextState;
        });
        setIsVideoOff(!nextState);
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'media-toggle',
              mediaType: 'video',
              enabled: nextState
            })
          );
        }
      }
    }
  };

  const handleEndCall = async () => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify({ type: 'call-ended' }));
        ws.close();
      } catch (e) {}
    }
    wsRef.current = null;
    stopCamera();
    if (selectedId) {
      await api.put(`/appointments/${selectedId}/meeting`, { meeting_status: 'Completed' }).catch(() => {});
    }
    setCallEnded(true);
    if (onEndCall) onEndCall();
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!chatText.trim() || !selectedId) return;
    try {
      await api.post(`/consultations/${selectedId}/messages`, {
        text: chatText.trim(),
        language: user.language || 'English'
      });
      setChatText('');
      const res = await api.get(`/consultations/${selectedId}/messages`);
      setMessages(res.data);
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  if (!selectedId && aptList.length === 0) {
    return (
      <div className="card empty-state">
        <Video size={48} />
        <h3 style={{ marginTop: 12 }}>No Active Teleconsultations</h3>
        <p>You need a confirmed appointment to start or join a teleconsultation room.</p>
      </div>
    );
  }

  // Room title according to role
  const roomTitle =
    user.role === 'DOCTOR'
      ? 'Doctor Teleconsultation Room'
      : user.role === 'PATIENT'
      ? 'Patient Teleconsultation Room'
      : 'Teleconsultation Room';

  const roomSubtitle =
    user.role === 'DOCTOR'
      ? 'Live clinical examination, patient remote video, prescription notes & diagnostic records'
      : 'Secure live video & audio consultation with your verified consulting doctor';

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">{roomTitle}</h2>
          <p className="page-subtitle">{roomSubtitle}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Switch Session:</label>
          <select
            className="form-select"
            style={{ width: 'auto' }}
            value={selectedId || ''}
            onChange={(e) => handleSwitchSession(e.target.value)}
          >
            {aptList.map((a) => (
              <option key={a.id} value={a.id}>
                #{a.id} - {user.role === 'DOCTOR' ? a.patient_name : a.doctor_name} ({a.date.slice(0, 10)})
              </option>
            ))}
          </select>
        </div>
      </div>

      {mediaError && (
        <div className="alert alert-info">
          <Info size={18} />
          <span>{mediaError}</span>
        </div>
      )}

      <div className="teleconsult-container">
        {/* Video feed column */}
        <div className="video-screen">
          {/* Hidden audio for remote audio tracks */}
          <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />

          {/* STATE 1: Call Lobby (User has NOT joined yet - camera and microphone are completely OFF) */}
          {!mediaActive && !callEnded && (
            <div className="teleconsult-lobby">
              <div className="lobby-content">
                <div className="lobby-icon">
                  {callMode === 'audio' ? <PhoneCall size={44} /> : <Video size={44} />}
                </div>
                <h3 style={{ color: '#fff', fontSize: '1.25rem', marginTop: 12, marginBottom: 6 }}>
                  {user.role === 'DOCTOR' ? 'Doctor Teleconsultation Room' : 'Patient Teleconsultation Room'}
                </h3>
                <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: 16 }}>
                  {session ? (
                    <>
                      Consultation with <b>{user.role === 'DOCTOR' ? session.patient_name : session.doctor_name}</b>
                      <div style={{ fontSize: '0.82rem', opacity: 0.85, marginTop: 4 }}>
                        Session #{session.id} • {session.date?.slice(0, 10)} at {session.time?.slice(0, 5)} • {session.reason || 'General Consultation'}
                      </div>
                    </>
                  ) : (
                    'Select an appointment session to join.'
                  )}
                </div>

                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 18 }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${callMode === 'video' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setCallMode('video')}
                  >
                    <Video size={16} /> Video Call
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${callMode === 'audio' ? 'btn-primary' : 'btn-outline'}`}
                    onClick={() => setCallMode('audio')}
                  >
                    <PhoneCall size={16} /> Voice Only
                  </button>
                </div>

                <div>
                  <button
                    type="button"
                    className="btn btn-success btn-lg"
                    style={{ padding: '12px 28px', fontSize: '1rem', fontWeight: 700, borderRadius: 24 }}
                    onClick={startCamera}
                    disabled={!selectedId}
                  >
                    <Video size={20} /> Join Call
                  </button>
                </div>

                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 18, fontSize: '0.78rem', color: '#64748b' }}>
                  <ShieldCheck size={16} color="#22c55e" />
                  <span>Camera & microphone remain off until you click <b>Join Call</b>.</span>
                </div>
              </div>
            </div>
          )}

          {/* STATE 2: Video Mode when media is active */}
          {mediaActive && callMode !== 'audio' && (
            <>
              {/* Main Video Area: Displays ONLY the Remote Participant's stream */}
              {remoteStream ? (
                <>
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="video-feed"
                    style={{ display: remoteVideoOff ? 'none' : 'block' }}
                  />
                  {remoteVideoOff && (
                    <div className="remote-video-off-screen">
                      <User size={64} style={{ opacity: 0.5, marginBottom: 12 }} />
                      <h4 style={{ color: '#fff' }}>
                        {user.role === 'DOCTOR' ? session?.patient_name : session?.doctor_name}
                      </h4>
                      <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Camera turned off (Audio active)</p>
                    </div>
                  )}
                  <div className="remote-peer-label">
                    <span>
                      {user.role === 'DOCTOR'
                        ? `Patient: ${session?.patient_name || 'Patient'}`
                        : `Doctor: ${session?.doctor_name || 'Doctor'}`}
                    </span>
                    {remoteAudioMuted && <span style={{ color: '#ef4444', marginLeft: 8 }}>🔇 Muted</span>}
                  </div>
                </>
              ) : (
                /* Main Area: Displays "Waiting for participant to join..." when remote user hasn't joined */
                <div className="waiting-peer-container">
                  <div className="waiting-icon-pulse">
                    <User size={48} color="#38bdf8" />
                  </div>
                  <h3 style={{ marginTop: 16, fontSize: '1.25rem', color: '#fff' }}>
                    Waiting for participant to join...
                  </h3>
                  <p style={{ color: '#94a3b8', fontSize: '0.88rem', maxWidth: 380, marginTop: 6 }}>
                    {user.role === 'DOCTOR'
                      ? `Waiting for patient ${session?.patient_name || ''} to connect to this consultation session.`
                      : `Waiting for Dr. ${session?.doctor_name || ''} to connect to this consultation session.`}
                  </p>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      marginTop: 14,
                      background: 'rgba(255,255,255,0.08)',
                      padding: '6px 14px',
                      borderRadius: 20
                    }}
                  >
                    <div className="pulse-dot pulse-blue" />
                    <span style={{ fontSize: '0.8rem', color: '#e2e8f0' }}>Room #{selectedId} Active</span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 12 }}>
                    Your local camera preview is active in the bottom right corner.
                  </p>
                </div>
              )}

              {/* Picture-in-Picture Preview: Displays ONLY Current User's Local Camera */}
              <div className="local-pip-container">
                {!isVideoOff ? (
                  <video ref={localPipRef} className="local-pip-video" muted playsInline autoPlay />
                ) : (
                  <div className="local-pip-off">
                    <VideoOff size={22} color="#94a3b8" />
                    <span>Camera off</span>
                  </div>
                )}
                <div className="local-pip-badge">
                  <span>{user.role === 'DOCTOR' ? 'Doctor (You)' : 'Patient (You)'}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {isVideoOff ? 'Off' : 'Live'}
                    {isMuted ? '🔇' : '🎤'}
                  </span>
                </div>
              </div>
            </>
          )}

          {/* STATE 3: Audio-only Call Screen */}
          {mediaActive && callMode === 'audio' && (
            <div className="audio-call-screen">
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px auto',
                    border: '3px solid rgba(255,255,255,0.4)'
                  }}
                >
                  <PhoneCall size={36} color="#fff" />
                </div>
                <h3 style={{ color: '#fff', fontSize: '1.2rem', marginBottom: 8 }}>
                  {session ? (user.role === 'DOCTOR' ? session.patient_name : session.doctor_name) : 'Voice Consultation'}
                </h3>
                <div style={{ color: '#94a3b8', fontSize: '0.9rem', marginBottom: 20 }}>
                  {remoteStream || peers.length > 0 ? '🟢 Connected' : '⏳ Waiting for participant to join...'}
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#38bdf8', fontFamily: 'monospace' }}>
                  {formatDuration(callDuration)}
                </div>
              </div>
            </div>
          )}

          {/* Call Ended Overlay */}
          {callEnded && (
            <div className="call-ended-overlay">
              <h2>Consultation Ended</h2>
              <p>Thank you for using MediConnect AI Teleconsultation.</p>
              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button type="button" className="btn btn-outline" onClick={() => setCallEnded(false)}>
                  Rejoin Room
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => (onEndCall ? onEndCall() : window.location.reload())}
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          )}

          {/* Top Video Overlay Info */}
          <div className="video-overlay-info">
            <div>
              <b style={{ fontSize: '1rem' }}>
                {session ? `${session.doctor_name} ↔ ${session.patient_name}` : 'Consultation'}
              </b>
              <div style={{ fontSize: '0.78rem', opacity: 0.85 }}>
                {session ? `${session.date?.slice(0, 10)} at ${session.time?.slice(0, 5)}` : ''}
                {mediaActive && (
                  <span style={{ marginLeft: 12, color: '#38bdf8', fontFamily: 'monospace', fontWeight: 700 }}>
                    {' '}
                    ⏱ {formatDuration(callDuration)}
                  </span>
                )}
              </div>
            </div>
            <div className="video-status-indicator">
              <div className={`pulse-dot ${remoteStream ? '' : 'pulse-blue'}`} />
              <span>{remoteStream ? 'Connected' : mediaActive ? 'Waiting for Peer' : 'Not Joined'}</span>
            </div>
          </div>

          {/* Bottom Video Controls Bar */}
          <div className="video-controls">
            {mediaActive ? (
              <>
                <button
                  type="button"
                  className={`control-btn ${isMuted ? 'muted' : 'active'}`}
                  onClick={toggleMute}
                  title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
                >
                  {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                </button>

                {callMode !== 'audio' && (
                  <button
                    type="button"
                    className={`control-btn ${isVideoOff ? 'muted' : 'active'}`}
                    onClick={toggleVideo}
                    title={isVideoOff ? 'Turn Video On' : 'Turn Video Off'}
                  >
                    {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
                  </button>
                )}

                <button
                  type="button"
                  className="control-btn end"
                  onClick={handleEndCall}
                  title="End Consultation"
                >
                  <PhoneOff size={20} />
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-success btn-sm"
                style={{ padding: '8px 20px', fontWeight: 700, borderRadius: 20 }}
                onClick={startCamera}
                disabled={!selectedId}
              >
                <Video size={16} /> Join Call
              </button>
            )}
          </div>
        </div>

        {/* Live chat panel with Consultation Reports toggle */}
        <div className="chat-panel">
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
            <button
              type="button"
              style={{
                flex: 1,
                padding: '10px 12px',
                border: 'none',
                background: panelTab === 'chat' ? '#ffffff' : 'transparent',
                fontWeight: panelTab === 'chat' ? 700 : 500,
                color: panelTab === 'chat' ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom: panelTab === 'chat' ? '2px solid var(--primary)' : 'none',
                cursor: 'pointer',
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
              onClick={() => setPanelTab('chat')}
            >
              <span>💬 Notes & Chat</span>
            </button>
            <button
              type="button"
              style={{
                flex: 1,
                padding: '10px 12px',
                border: 'none',
                background: panelTab === 'reports' ? '#ffffff' : 'transparent',
                fontWeight: panelTab === 'reports' ? 700 : 500,
                color: panelTab === 'reports' ? 'var(--primary)' : 'var(--text-muted)',
                borderBottom: panelTab === 'reports' ? '2px solid var(--primary)' : 'none',
                cursor: 'pointer',
                fontSize: '0.84rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6
              }}
              onClick={() => setPanelTab('reports')}
            >
              <FileText size={14} />
              <span>Patient Reports</span>
            </button>
          </div>

          {panelTab === 'reports' ? (
            <TeleconsultationReportsPanel appointmentId={selectedId} user={user} />
          ) : (
            <>
              <div className="chat-messages">
                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40, fontSize: '0.85rem' }}>
                    No messages yet. Send a note or message below.
                  </div>
                ) : (
                  messages.map((m) => {
                    const isMine = m.sender_id === user.id;
                    return (
                      <div key={m.id} className={`chat-bubble ${isMine ? 'mine' : 'theirs'}`}>
                        <div className="chat-sender">{m.sender_name} ({m.sender_role})</div>
                        <div>{m.text}</div>
                        <small style={{ fontSize: '0.68rem', opacity: 0.75, display: 'block', marginTop: 2 }}>
                          {m.created_at?.slice(11, 16)}
                        </small>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Reusable Consultation Payment QR Code Banner (₹500) */}
              <ConsultationPaymentQR
                appointmentId={selectedId}
                session={session}
                user={user}
                patientName={session?.patient_name}
                doctorName={session?.doctor_name}
              />

              <form className="chat-input-bar" onSubmit={sendMessage}>
                <input
                  className="form-input"
                  style={{ flex: 1 }}
                  placeholder="Type message or clinical note..."
                  value={chatText}
                  onChange={(e) => setChatText(e.target.value)}
                />
                <button type="submit" className="btn btn-primary btn-sm">
                  <Send size={16} />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// My Prescriptions View (Patient)
function MyPrescriptionsView() {
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/prescriptions')
      .then((res) => setPrescriptions(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">My Prescriptions</h2>
          <p className="page-subtitle">Prescriptions issued by your verified consulting doctors</p>
        </div>
      </div>

      {loading ? (
        <p>Loading prescriptions...</p>
      ) : prescriptions.length === 0 ? (
        <div className="empty-state card">
          <FileText size={40} />
          <p>No prescriptions have been issued for you yet.</p>
        </div>
      ) : (
        prescriptions.map((rx) => (
          <div key={rx.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: '1.15rem' }}>Prescription #{rx.id}</h3>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Issued by <b>{rx.doctor_name}</b> ({rx.doctor_specialization}) on {rx.created_at.slice(0, 10)}
                </span>
              </div>
              <span className="badge badge-Confirmed">Doctor Verified</span>
            </div>

            {rx.diagnosis && (
              <div style={{ marginBottom: 12, fontSize: '0.9rem' }}>
                <b>Diagnosis:</b> {rx.diagnosis}
              </div>
            )}

            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Form</th>
                    <th>Dosage</th>
                    <th>Frequency</th>
                    <th>Duration</th>
                    <th>Instructions</th>
                  </tr>
                </thead>
                <tbody>
                  {rx.items?.map((item) => (
                    <tr key={item.id}>
                      <td><b>{item.medicine_name}</b></td>
                      <td>{item.dosage_form || 'Tablet'}</td>
                      <td>{item.dosage}</td>
                      <td>{item.frequency} time(s)/day</td>
                      <td>{item.days} days</td>
                      <td>{item.instructions || 'As advised'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {rx.notes && (
              <div style={{ marginTop: 14, fontSize: '0.85rem', color: 'var(--text-muted)', background: 'var(--bg-subtle)', padding: 10, borderRadius: 6 }}>
                <b>Doctor's Clinical Notes:</b> {rx.notes}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// Medicine Tracker View (Patient)
function MedicineTrackerView({ onReminderUpdated }) {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');

  const loadReminders = () => {
    setLoading(true);
    api.get('/reminders')
      .then((res) => {
        setReminders(res.data);
        if (onReminderUpdated) onReminderUpdated();
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReminders();
    const interval = setInterval(loadReminders, 20000);
    return () => clearInterval(interval);
  }, []);

  const isDoseOverdue = (rem) => {
    if (!rem || rem.status !== 'Active') return false;
    if (rem.today_status === 'Taken') return false;
    if (!rem.remind_time) return false;
    const now = new Date();
    const [h, m] = rem.remind_time.split(':').map(Number);
    const scheduled = new Date();
    scheduled.setHours(h, m, 0, 0);
    return now > scheduled;
  };

  const handleTakeDose = async (id, medName, schedTime) => {
    if (!window.confirm(`Confirm taking ${medName || 'prescribed dose'} scheduled for ${schedTime || 'today'}?`)) {
      return;
    }
    try {
      const { data } = await api.post(`/reminders/${id}/take`);
      setActionMsg(data.message || 'Dose recorded as taken!');
      loadReminders();
      if (onReminderUpdated) onReminderUpdated();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    try {
      await api.put(`/reminders/${id}`, {
        status: currentStatus === 'Active' ? 'Completed' : 'Active'
      });
      loadReminders();
      if (onReminderUpdated) onReminderUpdated();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Medicine Tracker & Daily Adherence</h2>
          <p className="page-subtitle">Track scheduled medicine doses, log adherence, and manage reminders</p>
        </div>
      </div>

      {actionMsg && (
        <div className="alert alert-success">
          <CheckCircle2 size={18} />
          <span>{actionMsg}</span>
        </div>
      )}

      {loading ? (
        <p>Loading dose schedule...</p>
      ) : reminders.length === 0 ? (
        <div className="empty-state card">
          <Pill size={40} />
          <p>No active medicine reminders found in your prescriptions.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Scheduled Time</th>
                  <th>Medicine</th>
                  <th>Dosage</th>
                  <th>Prescribing Doctor</th>
                  <th>Instructions</th>
                  <th>Today's Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {reminders.map((rem) => {
                  const isTaken = rem.today_status === 'Taken';
                  const isOverdue = isDoseOverdue(rem);

                  return (
                    <tr key={rem.id} style={isOverdue ? { background: 'rgba(254, 242, 242, 0.45)' } : {}}>
                      <td>
                        <b style={{ color: isOverdue ? '#dc2626' : 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          {isOverdue ? <AlertTriangle size={15} color="#dc2626" /> : <span>⏰</span>}
                          {rem.remind_time.slice(0, 5)}
                        </b>
                      </td>
                      <td>
                        <b>{rem.medicine_name}</b> <small>({rem.dosage_form || 'Tablet'})</small>
                      </td>
                      <td>{rem.dosage}</td>
                      <td>{rem.doctor_name}</td>
                      <td>{rem.instructions}</td>
                      <td>
                        {isTaken ? (
                          <span className="badge badge-Confirmed" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircle2 size={13} /> Taken Today {rem.taken_at ? `(${new Date(rem.taken_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` : ''}
                          </span>
                        ) : isOverdue ? (
                          <span
                            className="badge badge-Cancelled"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              background: '#fee2e2',
                              color: '#b91c1c',
                              border: '1px solid #fca5a5',
                              fontWeight: 700
                            }}
                          >
                            <AlertTriangle size={13} /> Overdue
                          </span>
                        ) : (
                          <span className="badge badge-Pending" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={13} /> Pending Dose
                          </span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className={`btn btn-sm ${isTaken ? 'btn-secondary' : isOverdue ? 'btn-danger' : 'btn-success'}`}
                            onClick={() => handleTakeDose(rem.id, rem.medicine_name, rem.remind_time.slice(0, 5))}
                            disabled={isTaken}
                            style={isOverdue ? { background: '#dc2626', borderColor: '#b91c1c', color: '#fff', fontWeight: 700 } : {}}
                          >
                            {isTaken ? 'Recorded' : isOverdue ? 'Confirm Taken' : 'Mark as Taken'}
                          </button>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => handleToggleStatus(rem.id, rem.status)}
                            title="Toggle Reminder On/Off"
                          >
                            {rem.status === 'Active' ? 'Active' : 'Muted'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// Nearby Hospitals View
function NearbyHospitalsView() {
  const [hospitals, setHospitals] = useState([]);
  const [coords, setCoords] = useState(null);
  const [locationNote, setLocationNote] = useState('Detecting GPS location...');
  const [search, setSearch] = useState('');
  const [emergencyOnly, setEmergencyOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  // Request actual GPS coordinates
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocationNote(`Current GPS: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        },
        () => {
          // Fallback to real Erode healthcare district coordinates
          setCoords({ lat: 11.3410, lng: 77.7172 });
          setLocationNote('Device GPS not enabled – using standard Erode district coordinates (11.3410° N, 77.7172° E).');
        }
      );
    } else {
      setCoords({ lat: 11.3410, lng: 77.7172 });
      setLocationNote('Browser geolocation unavailable – using default district coordinates.');
    }
  }, []);

  useEffect(() => {
    if (!coords) return;
    setLoading(true);
    api.get(`/hospitals/nearby?lat=${coords.lat}&lng=${coords.lng}&search=${encodeURIComponent(search)}`)
      .then((res) => setHospitals(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [coords, search]);

  const filtered = hospitals.filter((h) => !emergencyOnly || h.emergency);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Nearby Hospitals & Emergency Centers</h2>
          <p className="page-subtitle">Verified hospital facilities, 24/7 emergency centers, and turn-by-turn directions</p>
        </div>
      </div>

      <div className="alert alert-info">
        <MapPin size={18} />
        <span>{locationNote}</span>
      </div>

      <div className="card" style={{ padding: '16px 20px' }}>
        <div className="form-row" style={{ alignItems: 'center' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <input
              className="form-input"
              placeholder="Search by hospital name or specialty (e.g. ICU, Surgery)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={emergencyOnly}
              onChange={(e) => setEmergencyOnly(e.target.checked)}
            />
            🚨 24/7 Emergency Only
          </label>
        </div>
      </div>

      {coords && (
        <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
          <iframe
            title="OpenStreetMap"
            style={{ width: '100%', height: 280, border: 0 }}
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${coords.lng - 0.06},${coords.lat - 0.05},${coords.lng + 0.06},${coords.lat + 0.05}&layer=mapnik&marker=${coords.lat},${coords.lng}`}
          />
        </div>
      )}

      {loading ? (
        <p>Loading hospitals...</p>
      ) : filtered.length === 0 ? (
        <div className="empty-state card">
          <MapPin size={40} />
          <p>No hospital centers found matching your query.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 20 }}>
          {filtered.map((h) => (
            <div key={h.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <h3 style={{ fontSize: '1.15rem' }}>{h.name}</h3>
                  {h.emergency ? (
                    <span className="badge badge-emergency">🚨 24/7 Emergency</span>
                  ) : (
                    <span className="badge badge-Completed">Clinic</span>
                  )}
                </div>

                <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.6 }}>
                  <div>📍 {h.address}</div>
                  <div>📞 <b>Phone:</b> {h.phone}</div>
                  <div>🩺 <b>Services:</b> {h.services}</div>
                  {h.distance_km !== undefined && (
                    <div style={{ marginTop: 6, fontWeight: 700, color: 'var(--primary)' }}>
                      🚗 Approx. Distance: {h.distance_km} km
                    </div>
                  )}
                </div>
              </div>

              {coords && (
                <a
                  className="btn btn-outline"
                  style={{ width: '100%', marginTop: 8 }}
                  href={`https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${coords.lat},${coords.lng};${h.lat},${h.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MapPin size={16} /> Open Directions Map →
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// User Profile View (Universal)
function ProfileView({ user, onProfileUpdated }) {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    address: '',
    language: 'English',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    doctorInfo: {},
    healthWorkerInfo: {}
  });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/auth/me').then((res) => {
      setProfile(res.data);
      setForm({
        name: res.data.name || '',
        phone: res.data.phone || '',
        address: res.data.address || '',
        language: res.data.language || 'English',
        emergency_contact_name: res.data.emergency_contact_name || '',
        emergency_contact_phone: res.data.emergency_contact_phone || '',
        doctorInfo: res.data.doctorInfo || {},
        healthWorkerInfo: res.data.healthWorkerInfo || {}
      });
    });
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setMsg('');
    setErr('');
    setSaving(true);
    try {
      await api.put('/auth/profile', form);
      setMsg('Profile details updated successfully!');
      if (onProfileUpdated) onProfileUpdated();
    } catch (error) {
      setErr(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  if (!profile) return <p>Loading profile...</p>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">My Profile</h2>
          <p className="page-subtitle">Manage personal information and communication preferences</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 680 }}>
        {msg && (
          <div className="alert alert-success">
            <CheckCircle2 size={18} />
            <span>{msg}</span>
          </div>
        )}
        {err && (
          <div className="alert alert-danger">
            <AlertCircle size={18} />
            <span>{err}</span>
          </div>
        )}

        <form onSubmit={handleSave}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                className="form-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email (Read-Only)</label>
              <input className="form-input" value={profile.email} disabled />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                className="form-input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Preferred Language</label>
              <select
                className="form-select"
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
              >
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Address</label>
            <input
              className="form-input"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>

          {/* Patient emergency contacts */}
          {user.role === 'PATIENT' && (
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Emergency Contact Name</label>
                <input
                  className="form-input"
                  value={form.emergency_contact_name}
                  onChange={(e) => setForm({ ...form, emergency_contact_name: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Emergency Contact Phone</label>
                <input
                  className="form-input"
                  value={form.emergency_contact_phone}
                  onChange={(e) => setForm({ ...form, emergency_contact_phone: e.target.value })}
                />
              </div>
            </div>
          )}

          {/* Doctor professional fields */}
          {user.role === 'DOCTOR' && (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Specialization</label>
                  <input
                    className="form-input"
                    value={form.doctorInfo.specialization || ''}
                    onChange={(e) => setForm({
                      ...form,
                      doctorInfo: { ...form.doctorInfo, specialization: e.target.value }
                    })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Consultation Fee (₹)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={form.doctorInfo.consultation_fee || ''}
                    onChange={(e) => setForm({
                      ...form,
                      doctorInfo: { ...form.doctorInfo, consultation_fee: e.target.value }
                    })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Professional Bio</label>
                <textarea
                  className="form-textarea"
                  rows="3"
                  value={form.doctorInfo.bio || ''}
                  onChange={(e) => setForm({
                    ...form,
                    doctorInfo: { ...form.doctorInfo, bio: e.target.value }
                  })}
                />
              </div>
            </>
          )}

          {/* Health Worker fields */}
          {user.role === 'HEALTH_WORKER' && (
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Assigned Community Area</label>
                <input
                  className="form-input"
                  value={form.healthWorkerInfo.assigned_area || ''}
                  onChange={(e) => setForm({
                    ...form,
                    healthWorkerInfo: { ...form.healthWorkerInfo, assigned_area: e.target.value }
                  })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Employee ID</label>
                <input
                  className="form-input"
                  value={form.healthWorkerInfo.employee_id || ''}
                  disabled
                />
              </div>
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Profile Changes'}
          </button>
        </form>

        {/* Change Password Section */}
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 28, paddingTop: 24 }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lock size={18} /> Change Password
          </h3>
          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}

// Change Password Form (reusable sub-component)
function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwMsg('');
    setPwErr('');
    if (newPassword.length < 8) {
      setPwErr('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwErr('New password and confirmation do not match.');
      return;
    }
    setPwSaving(true);
    try {
      await api.put('/auth/change-password', {
        currentPassword,
        newPassword
      });
      setPwMsg('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwErr(getErrorMessage(err));
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <form onSubmit={handleChangePassword}>
      {pwMsg && <div className="alert alert-success"><CheckCircle2 size={18} /> <span>{pwMsg}</span></div>}
      {pwErr && <div className="alert alert-danger"><AlertCircle size={18} /> <span>{pwErr}</span></div>}
      <div className="form-group">
        <label className="form-label">Current Password *</label>
        <input type="password" className="form-input" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required placeholder="Enter your current password" />
      </div>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">New Password *</label>
          <input type="password" className="form-input" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required placeholder="At least 8 characters" />
        </div>
        <div className="form-group">
          <label className="form-label">Confirm New Password *</label>
          <input type="password" className="form-input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required placeholder="Re-enter new password" />
        </div>
      </div>
      <button type="submit" className="btn btn-primary" disabled={pwSaving}>
        {pwSaving ? 'Updating...' : 'Update Password'}
      </button>
    </form>
  );
}

// ==========================================
// 2. DOCTOR DASHBOARD & SUBVIEWS
// ==========================================

function DoctorDashboardHome({ user, onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/doctor/dashboard')
      .then((res) => setData(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading doctor dashboard...</p>;
  const stats = data?.stats || {};
  const upcoming = data?.upcoming || [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Doctor Dashboard</h2>
          <p className="page-subtitle">Welcome, {user.name} – Clinical Overview</p>
        </div>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => onNavigate('patient-reports')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
        >
          <FileText size={16} /> Patient Medical Reports
        </button>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon blue">
            <Calendar size={24} />
          </div>
          <div>
            <div className="stat-value">{stats.todayAppointments || 0}</div>
            <div className="stat-label">Today's Appointments</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon amber">
            <Clock size={24} />
          </div>
          <div>
            <div className="stat-value">{stats.pendingRequests || 0}</div>
            <div className="stat-label">Pending Requests</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <Users size={24} />
          </div>
          <div>
            <div className="stat-value">{stats.totalPatients || 0}</div>
            <div className="stat-label">Assigned Patients</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon purple">
            <FileText size={24} />
          </div>
          <div>
            <div className="stat-value">{stats.totalPrescriptions || 0}</div>
            <div className="stat-label">Prescriptions Issued</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <span>Upcoming Appointments Schedule</span>
          <button className="btn btn-outline btn-sm" onClick={() => onNavigate('appointments')}>
            Manage All Appointments
          </button>
        </div>

        {upcoming.length === 0 ? (
          <div className="empty-state">
            <Calendar size={36} />
            <p>No upcoming appointments found.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Patient Name</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((a) => (
                  <tr key={a.id}>
                    <td><b>{a.patient_name}</b></td>
                    <td>{a.date.slice(0, 10)}</td>
                    <td>⏰ {a.time.slice(0, 5)}</td>
                    <td>{a.reason}</td>
                    <td><span className={`badge badge-${a.status}`}>{a.status}</span></td>
                    <td>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => onNavigate('appointments')}
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Patient Medical Reports Section on Doctor Dashboard */}
      <div style={{ marginTop: 24 }}>
        <DoctorDashboardReportsSection onNavigate={onNavigate} />
      </div>
    </div>
  );
}

// Doctor Patients List & Medical Records View
function DoctorPatientsView() {
  const [patients, setPatients] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientDetails, setPatientDetails] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/doctor/patients')
      .then((res) => setPatients(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const openPatient = (id) => {
    setSelectedPatient(id);
    api.get(`/doctor/patients/${id}`)
      .then((res) => setPatientDetails(res.data))
      .catch((err) => alert(getErrorMessage(err)));
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">My Patients</h2>
          <p className="page-subtitle">Authorized patient records under your clinical care</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selectedPatient ? '1fr 1fr' : '1fr', gap: 20 }}>
        {/* Patients list */}
        <div className="card" style={{ padding: 0 }}>
          <div className="card-title" style={{ padding: '16px 20px', margin: 0 }}>
            Consulted Patients ({patients.length})
          </div>
          {loading ? (
            <p style={{ padding: 20 }}>Loading patients...</p>
          ) : patients.length === 0 ? (
            <div className="empty-state">
              <Users size={36} />
              <p>No patients consulted yet.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Patient Name</th>
                    <th>Contact</th>
                    <th>Total Appointments</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map((p) => (
                    <tr key={p.id}>
                      <td><b>{p.name}</b></td>
                      <td>{p.phone || p.email}</td>
                      <td>{p.total_appointments}</td>
                      <td>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => openPatient(p.id)}
                        >
                          View Record
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Selected Patient Medical Details */}
        {selectedPatient && patientDetails && (
          <div className="card">
            <div className="card-title">
              <span>Medical Record: {patientDetails.patient.name}</span>
              <button className="btn btn-outline btn-sm" onClick={() => setSelectedPatient(null)}>
                Close
              </button>
            </div>

            <div style={{ fontSize: '0.88rem', marginBottom: 14, lineHeight: 1.6 }}>
              <div>📧 <b>Email:</b> {patientDetails.patient.email}</div>
              <div>📞 <b>Phone:</b> {patientDetails.patient.phone}</div>
              <div>⚧ <b>Gender:</b> {patientDetails.patient.gender} | 🎂 <b>DOB:</b> {patientDetails.patient.dob?.slice(0, 10)}</div>
              <div>🏠 <b>Address:</b> {patientDetails.patient.address}</div>
            </div>

            <h4 style={{ fontSize: '0.95rem', marginTop: 14, marginBottom: 8 }}>Past Prescriptions:</h4>
            {patientDetails.prescriptions?.length === 0 ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No previous prescriptions issued.</p>
            ) : (
              patientDetails.prescriptions.map((rx) => (
                <div key={rx.id} style={{ background: 'var(--bg-subtle)', padding: 10, borderRadius: 6, marginBottom: 8, fontSize: '0.85rem' }}>
                  <b>Rx #{rx.id} ({rx.created_at.slice(0, 10)})</b>
                  <div>{rx.diagnosis}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Doctor Appointments Management View
function DoctorAppointmentsView({ onPrescribe, onJoinTeleconsult }) {
  const [appointments, setAppointments] = useState([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);

  const loadAppointments = () => {
    setLoading(true);
    api.get('/appointments')
      .then((res) => setAppointments(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAppointments();
  }, []);

  const handleUpdateStatus = async (id, status) => {
    try {
      await api.put(`/appointments/${id}/status`, { status });
      loadAppointments();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const filtered = appointments.filter((a) => filter === 'ALL' || a.status === filter);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Appointment Management</h2>
          <p className="page-subtitle">Accept, reject, or complete clinical consultations</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {['ALL', 'Pending', 'Confirmed', 'Completed', 'Cancelled'].map((st) => (
          <button
            key={st}
            className={`btn btn-sm ${filter === st ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter(st)}
          >
            {st} ({appointments.filter((a) => st === 'ALL' || a.status === st).length})
          </button>
        ))}
      </div>

      {loading ? (
        <p>Loading appointments...</p>
      ) : filtered.length === 0 ? (
        <div className="empty-state card">
          <Calendar size={40} />
          <p>No appointments found.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Date & Time</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((apt) => (
                  <tr key={apt.id}>
                    <td>
                      <b>{apt.patient_name}</b>
                      <br />
                      <small>{apt.patient_phone || apt.patient_email}</small>
                    </td>
                    <td>
                      {apt.date.slice(0, 10)}
                      <br />
                      <small>⏰ {apt.time.slice(0, 5)}</small>
                    </td>
                    <td>{apt.reason}</td>
                    <td><span className={`badge badge-${apt.status}`}>{apt.status}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {apt.status === 'Pending' && (
                          <>
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => handleUpdateStatus(apt.id, 'Confirmed')}
                            >
                              Accept
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleUpdateStatus(apt.id, 'Rejected')}
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {['Confirmed', 'In Progress', 'Waiting for Doctor', 'Waiting for Patient'].includes(apt.status) && (
                          <>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => onJoinTeleconsult(apt.id, 'video')}
                            >
                              <Video size={14} /> Video
                            </button>
                            <button
                              className="btn btn-sm"
                              style={{ background: '#7c3aed', color: '#fff', borderColor: '#7c3aed' }}
                              onClick={() => onJoinTeleconsult(apt.id, 'audio')}
                            >
                              <PhoneCall size={14} /> Voice
                            </button>
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => handleUpdateStatus(apt.id, 'Completed')}
                            >
                              Complete
                            </button>
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => onPrescribe(apt.id, apt.patient_id, apt.patient_name)}
                            >
                              <Pill size={14} /> Prescribe
                            </button>
                          </>
                        )}
                        {apt.status === 'Completed' && (
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => onPrescribe(apt.id, apt.patient_id, apt.patient_name)}
                          >
                            <Pill size={14} /> Prescribe
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// HEALTH WORKER APPOINTMENTS VIEW
// ==========================================
function HealthWorkerAppointmentsView({ user, onJoinTeleconsult }) {
  const [tab, setTab] = useState('list'); // 'list' | 'book'
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  // Booking form state
  const [bookPatientId, setBookPatientId] = useState('');
  const [bookDoctorId, setBookDoctorId] = useState('');
  const [bookDate, setBookDate] = useState('');
  const [bookTime, setBookTime] = useState('');
  const [bookReason, setBookReason] = useState('');
  const [bookConsultType, setBookConsultType] = useState('Video');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [bookedSlots, setBookedSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [bookMsg, setBookMsg] = useState('');
  const [bookErr, setBookErr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];

  const loadAppointments = () => {
    setLoading(true);
    api.get('/appointments')
      .then((res) => setAppointments(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAppointments();
    api.get('/health-worker/patients').then((res) => setPatients(res.data)).catch(() => {});
    api.get('/doctors').then((res) => setDoctors(res.data)).catch(() => {});
  }, []);

  // Fetch available slots when doctor and date are selected
  useEffect(() => {
    if (!bookDoctorId || !bookDate) {
      setAvailableSlots([]);
      setBookedSlots([]);
      return;
    }
    setLoadingSlots(true);
    api.get(`/doctors/${bookDoctorId}/available-slots?date=${bookDate}`)
      .then((res) => {
        setAvailableSlots(res.data.availableSlots || []);
        setBookedSlots(res.data.bookedSlots || []);
      })
      .catch(() => {
        // Fallback to old endpoint
        api.get(`/doctors/${bookDoctorId}?date=${bookDate}`)
          .then((res) => {
            const { doctor, bookedSlots: bs } = res.data;
            if (!doctor) return;
            const startH = parseInt(doctor.start_time.slice(0, 2), 10);
            const endH = parseInt(doctor.end_time.slice(0, 2), 10);
            const slots = [];
            for (let h = startH; h < endH; h++) {
              const hh = h.toString().padStart(2, '0');
              slots.push(`${hh}:00`, `${hh}:30`);
            }
            setAvailableSlots(slots.filter(s => !(bs || []).includes(s)));
            setBookedSlots(bs || []);
          })
          .catch(() => {});
      })
      .finally(() => setLoadingSlots(false));
  }, [bookDoctorId, bookDate]);

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    setBookMsg('');
    setBookErr('');
    if (!bookPatientId || !bookDoctorId || !bookDate || !bookTime) {
      setBookErr('Please select patient, doctor, date, and time slot.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/appointments', {
        patient_id: bookPatientId,
        doctor_id: bookDoctorId,
        date: bookDate,
        time: bookTime,
        reason: bookReason.trim() || 'General Consultation',
        consultation_type: bookConsultType
      });
      setBookMsg('Appointment booked successfully for patient!');
      setBookTime('');
      setBookReason('');
      loadAppointments();
    } catch (err) {
      setBookErr(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = appointments.filter((a) => filter === 'ALL' || a.status === filter);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Appointments Management</h2>
          <p className="page-subtitle">View patient appointments and book doctor consultations on their behalf</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button className={`btn ${tab === 'list' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('list')}>
          📋 Appointment List
        </button>
        <button className={`btn ${tab === 'book' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTab('book')}>
          📅 Book Doctor Appointment for Patient
        </button>
      </div>

      {tab === 'book' && (
        <div className="card" style={{ maxWidth: 700, marginBottom: 20 }}>
          <div className="card-title">Book Doctor Appointment for Patient</div>
          {bookMsg && <div className="alert alert-success"><CheckCircle2 size={18} /> <span>{bookMsg}</span></div>}
          {bookErr && <div className="alert alert-danger"><AlertCircle size={18} /> <span>{bookErr}</span></div>}

          <form onSubmit={handleBookAppointment}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Select Patient *</label>
                <select className="form-select" value={bookPatientId} onChange={(e) => setBookPatientId(e.target.value)} required>
                  <option value="">-- Choose Patient --</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>#{p.id} - {p.name} ({p.phone})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Select Doctor *</label>
                <select className="form-select" value={bookDoctorId} onChange={(e) => { setBookDoctorId(e.target.value); setBookTime(''); }} required>
                  <option value="">-- Choose Doctor --</option>
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>{d.name} ({d.specialization})</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Appointment Date *</label>
                <input type="date" className="form-input" min={tomorrowStr} value={bookDate} onChange={(e) => { setBookDate(e.target.value); setBookTime(''); }} required />
              </div>
              <div className="form-group">
                <label className="form-label">Consultation Type</label>
                <select className="form-select" value={bookConsultType} onChange={(e) => setBookConsultType(e.target.value)}>
                  <option value="Video">📹 Video Consultation</option>
                  <option value="Audio">📞 Audio Consultation</option>
                  <option value="In-Person">🏥 In-Person Visit</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Available Time Slots</label>
              {!bookDate || !bookDoctorId ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Select doctor and date to check availability.</p>
              ) : loadingSlots ? (
                <p style={{ fontSize: '0.85rem' }}>Checking availability...</p>
              ) : availableSlots.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--danger)' }}>No available slots on this date.</p>
              ) : (
                <div className="slot-chips-grid">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      className={`slot-chip ${bookTime === slot ? 'selected' : ''} ${bookedSlots.includes(slot) ? 'booked' : ''}`}
                      onClick={() => !bookedSlots.includes(slot) && setBookTime(slot)}
                      disabled={bookedSlots.includes(slot)}
                    >
                      ⏰ {slot}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Reason for Visit</label>
              <textarea className="form-textarea" rows="2" placeholder="e.g. Follow-up for diabetes monitoring" value={bookReason} onChange={(e) => setBookReason(e.target.value)} />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submitting || !bookTime}>
              {submitting ? 'Booking...' : 'Confirm Appointment Booking'}
            </button>
          </form>
        </div>
      )}

      {tab === 'list' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
            {['ALL', 'Pending', 'Confirmed', 'Completed', 'Cancelled'].map((st) => (
              <button
                key={st}
                className={`btn btn-sm ${filter === st ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilter(st)}
              >
                {st} ({appointments.filter((a) => st === 'ALL' || a.status === st).length})
              </button>
            ))}
          </div>

          {loading ? (
            <p>Loading appointments...</p>
          ) : filtered.length === 0 ? (
            <div className="empty-state card">
              <Calendar size={40} />
              <p>No appointments found.</p>
            </div>
          ) : (
            <div className="card" style={{ padding: 0 }}>
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Patient</th>
                      <th>Doctor</th>
                      <th>Date & Time</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((apt) => (
                      <tr key={apt.id}>
                        <td><b>{apt.patient_name}</b></td>
                        <td>{apt.doctor_name}<br /><small>{apt.specialization}</small></td>
                        <td>{apt.date?.slice(0, 10)}<br /><small>⏰ {apt.time?.slice(0, 5)}</small></td>
                        <td><span className="badge badge-Confirmed">{apt.consultation_type || 'Video'}</span></td>
                        <td><span className={`badge badge-${apt.status}`}>{apt.status}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {['Confirmed', 'In Progress', 'Waiting for Doctor', 'Waiting for Patient'].includes(apt.status) && (
                              <>
                                <button className="btn btn-primary btn-sm" onClick={() => onJoinTeleconsult(apt.id, 'video')} title="Video Call">
                                  <Video size={14} /> Video
                                </button>
                                <button className="btn btn-sm" style={{ background: '#7c3aed', color: '#fff', borderColor: '#7c3aed' }} onClick={() => onJoinTeleconsult(apt.id, 'audio')} title="Voice Call">
                                  <PhoneCall size={14} /> Voice
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Doctor Availability Editor View
function DoctorAvailabilityView() {
  const [profile, setProfile] = useState(null);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [slotDuration, setSlotDuration] = useState(30);
  const [days, setDays] = useState('Mon,Tue,Wed,Thu,Fri,Sat');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/auth/me').then((res) => {
      setProfile(res.data);
      if (res.data.doctorInfo) {
        setStartTime(res.data.doctorInfo.start_time?.slice(0, 5) || '09:00');
        setEndTime(res.data.doctorInfo.end_time?.slice(0, 5) || '17:00');
        setSlotDuration(res.data.doctorInfo.slot_duration_mins || 30);
        setDays(res.data.doctorInfo.available_days || 'Mon,Tue,Wed,Thu,Fri,Sat');
      }
    });
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setMsg('');
    setErr('');
    setSaving(true);
    try {
      await api.put('/doctor/availability', {
        start_time: startTime + ':00',
        end_time: endTime + ':00',
        slot_duration_mins: parseInt(slotDuration, 10),
        available_days: days
      });
      setMsg('Doctor availability and working hours saved to MySQL database!');
    } catch (error) {
      setErr(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Manage Availability Schedule</h2>
          <p className="page-subtitle">Configure working hours and slot durations used for patient booking</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 600 }}>
        {msg && <div className="alert alert-success">{msg}</div>}
        {err && <div className="alert alert-danger">{err}</div>}

        <form onSubmit={handleSave}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Consultation Start Time *</label>
              <input
                type="time"
                className="form-input"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Consultation End Time *</label>
              <input
                type="time"
                className="form-input"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Slot Duration (Minutes)</label>
              <select
                className="form-select"
                value={slotDuration}
                onChange={(e) => setSlotDuration(e.target.value)}
              >
                <option value="15">15 Minutes</option>
                <option value="20">20 Minutes</option>
                <option value="30">30 Minutes</option>
                <option value="45">45 Minutes</option>
                <option value="60">60 Minutes</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Working Days</label>
              <input
                className="form-input"
                placeholder="e.g. Mon,Tue,Wed,Thu,Fri"
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Availability Schedule'}
          </button>
        </form>
      </div>
    </div>
  );
}

// Doctor Prescriptions View (Create & View)
function DoctorPrescriptionsView({ initialAppointmentId, initialPatientId, initialPatientName }) {
  const [prescriptions, setPrescriptions] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [showModal, setShowModal] = useState(!!initialPatientId);
  const [appointments, setAppointments] = useState([]);

  // Prescription form state
  const [patientId, setPatientId] = useState(initialPatientId || '');
  const [appointmentId, setAppointmentId] = useState(initialAppointmentId || '');
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([
    { medicine_id: '', dosage: '500 mg', frequency: 2, days: 5, instructions: 'Take after meals' }
  ]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const loadData = () => {
    api.get('/prescriptions').then((res) => setPrescriptions(res.data));
    api.get('/medicines').then((res) => {
      setMedicines(res.data);
      if (res.data.length > 0 && !items[0].medicine_id) {
        setItems([{ ...items[0], medicine_id: res.data[0].id }]);
      }
    });
    api.get('/appointments').then((res) => setAppointments(res.data));
  };

  useEffect(() => {
    loadData();
  }, []);

  const addItemRow = () => {
    setItems([
      ...items,
      { medicine_id: medicines[0]?.id || '', dosage: '1 dose', frequency: 1, days: 5, instructions: 'As advised' }
    ]);
  };

  const removeItemRow = (idx) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx, field, value) => {
    const updated = [...items];
    updated[idx][field] = value;
    setItems(updated);
  };

  const handleSavePrescription = async (e) => {
    e.preventDefault();
    setMsg('');
    setErr('');
    if (!patientId) {
      setErr('Please select a patient.');
      return;
    }

    setSaving(true);
    try {
      await api.post('/prescriptions', {
        patient_id: patientId,
        appointment_id: appointmentId || null,
        diagnosis,
        notes,
        items
      });
      setMsg('Prescription saved to MySQL and scheduled in patient medicine reminders!');
      setShowModal(false);
      setDiagnosis('');
      setNotes('');
      loadData();
    } catch (error) {
      setErr(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Doctor Prescriptions</h2>
          <p className="page-subtitle">Issue digital prescriptions and configure automatic patient reminders</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <PlusCircle size={16} /> Issue New Prescription
        </button>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}

      {/* Modal for creating prescription */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 700 }}>
            <div className="modal-header">
              <h3>Issue New Prescription</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            {err && <div className="alert alert-danger">{err}</div>}

            <form onSubmit={handleSavePrescription}>
              <div className="form-group">
                <label className="form-label">Patient *</label>
                <select
                  className="form-select"
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Patient --</option>
                  {appointments.map((a) => (
                    <option key={a.id} value={a.patient_id}>
                      {a.patient_name} (Apt #{a.id} - {a.date.slice(0, 10)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Clinical Diagnosis *</label>
                <input
                  className="form-input"
                  placeholder="e.g. Acute Bronchitis / Stage 1 Hypertension"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  required
                />
              </div>

              <div className="card" style={{ background: 'var(--bg-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <b>Prescribed Medicines & Doses</b>
                  <button type="button" className="btn btn-outline btn-sm" onClick={addItemRow}>
                    + Add Medicine
                  </button>
                </div>

                {items.map((item, idx) => (
                  <div key={idx} style={{ background: '#fff', padding: 12, borderRadius: 8, marginBottom: 10 }}>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Medicine</label>
                        <select
                          className="form-select"
                          value={item.medicine_id}
                          onChange={(e) => handleItemChange(idx, 'medicine_id', e.target.value)}
                        >
                          {medicines.map((m) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Dosage</label>
                        <input
                          className="form-input"
                          placeholder="e.g. 500 mg"
                          value={item.dosage}
                          onChange={(e) => handleItemChange(idx, 'dosage', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Frequency (Times/Day)</label>
                        <select
                          className="form-select"
                          value={item.frequency}
                          onChange={(e) => handleItemChange(idx, 'frequency', e.target.value)}
                        >
                          <option value="1">1 time (Morning)</option>
                          <option value="2">2 times (Morning & Night)</option>
                          <option value="3">3 times (TID)</option>
                          <option value="4">4 times (QID)</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Duration (Days)</label>
                        <input
                          type="number"
                          min="1"
                          max="60"
                          className="form-input"
                          value={item.days}
                          onChange={(e) => handleItemChange(idx, 'days', e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Instructions</label>
                      <input
                        className="form-input"
                        placeholder="e.g. After meals with warm water"
                        value={item.instructions}
                        onChange={(e) => handleItemChange(idx, 'instructions', e.target.value)}
                      />
                    </div>

                    {items.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => removeItemRow(idx)}
                      >
                        Remove Medicine
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="form-group">
                <label className="form-label">Physician Notes / Diet Advice</label>
                <textarea
                  className="form-textarea"
                  rows="2"
                  placeholder="e.g. Rest, increase fluids, review after 5 days if fever persists"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Issue Prescription'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Issued Prescriptions Table */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Rx #</th>
                <th>Patient</th>
                <th>Diagnosis</th>
                <th>Medicines</th>
                <th>Date Issued</th>
              </tr>
            </thead>
            <tbody>
              {prescriptions.map((rx) => (
                <tr key={rx.id}>
                  <td><b>#{rx.id}</b></td>
                  <td><b>{rx.patient_name}</b></td>
                  <td>{rx.diagnosis || 'Clinical evaluation'}</td>
                  <td>
                    {rx.items?.map((it) => (
                      <div key={it.id} style={{ fontSize: '0.82rem' }}>
                        • {it.medicine_name} ({it.dosage}) - {it.frequency}×/day for {it.days}d
                      </div>
                    ))}
                  </td>
                  <td>{rx.created_at.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 3. HEALTH WORKER DASHBOARD & SUBVIEWS
// ==========================================

function HealthWorkerHome({ user, onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/health-worker/dashboard')
      .then((res) => setData(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading health worker dashboard...</p>;
  const stats = data?.stats || {};
  const recentVisits = data?.recentVisits || [];
  const upcomingFollowups = data?.upcomingFollowups || [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Community Health Worker Dashboard</h2>
          <p className="page-subtitle">Welcome, {user.name} – Field & Patient Operations</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => onNavigate('patient-reports')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            <FileText size={16} /> Patient Medical Reports
          </button>
          <button className="btn btn-primary" onClick={() => onNavigate('register-patient')}>
            <PlusCircle size={16} /> Register New Patient
          </button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon blue">
            <Users size={24} />
          </div>
          <div>
            <div className="stat-value">{stats.managedPatients || 0}</div>
            <div className="stat-label">Managed Patients</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon teal">
            <HomeIcon size={24} />
          </div>
          <div>
            <div className="stat-value">{stats.totalHomeVisits || 0}</div>
            <div className="stat-label">Total Home Visits</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <ClipboardList size={24} />
          </div>
          <div>
            <div className="stat-value">{stats.recordedFollowups || 0}</div>
            <div className="stat-label">Recorded Follow-ups</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        {/* Recent home visits */}
        <div className="card">
          <div className="card-title">
            <span>Recent Home Visits</span>
            <button className="btn btn-outline btn-sm" onClick={() => onNavigate('home-visits')}>
              All Visits
            </button>
          </div>

          {recentVisits.length === 0 ? (
            <div className="empty-state">
              <HomeIcon size={36} />
              <p>No home visits logged yet.</p>
            </div>
          ) : (
            recentVisits.map((v) => (
              <div
                key={v.id}
                style={{
                  background: 'var(--bg-subtle)',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: 10
                }}
              >
                <b>{v.patient_name}</b> <small>({v.visit_date.slice(0, 10)})</small>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  🩺 BP: {v.blood_pressure || 'N/A'} | Pulse: {v.pulse || 'N/A'} | Sugar: {v.blood_sugar || 'N/A'}
                </div>
                <div style={{ fontSize: '0.85rem', marginTop: 4 }}>{v.observations}</div>
              </div>
            ))
          )}
        </div>

        {/* Upcoming followups */}
        <div className="card">
          <div className="card-title">
            <span>Scheduled Follow-ups</span>
            <button className="btn btn-outline btn-sm" onClick={() => onNavigate('patient-records')}>
              Patient Records
            </button>
          </div>

          {upcomingFollowups.length === 0 ? (
            <div className="empty-state">
              <ClipboardList size={36} />
              <p>No upcoming follow-ups scheduled.</p>
            </div>
          ) : (
            upcomingFollowups.map((f) => (
              <div
                key={f.id}
                style={{
                  background: 'var(--bg-subtle)',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: 10
                }}
              >
                <b>{f.patient_name}</b>
                <div style={{ fontSize: '0.82rem', color: 'var(--primary)', fontWeight: 600 }}>
                  📅 Follow-up Date: {f.next_followup_date?.slice(0, 10)}
                </div>
                <div style={{ fontSize: '0.84rem', marginTop: 4 }}>{f.observations}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Patient Medical Reports Section on Health Worker Dashboard */}
      <div style={{ marginTop: 24 }}>
        <HealthWorkerDashboardReportsSection onNavigate={onNavigate} />
      </div>
    </div>
  );
}

// Health Worker Managed Patients
function HealthWorkerPatientsView({ onSelectPatient }) {
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchPatients = () => {
    setLoading(true);
    api.get(`/health-worker/patients?search=${encodeURIComponent(search)}`)
      .then((res) => setPatients(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPatients();
  }, [search]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Assigned Patients</h2>
          <p className="page-subtitle">Community residents and patients under your primary healthcare management</p>
        </div>
      </div>

      <div className="card" style={{ padding: '16px 20px' }}>
        <input
          className="form-input"
          placeholder="Search by patient name, phone, or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p>Loading patient directory...</p>
      ) : patients.length === 0 ? (
        <div className="empty-state card">
          <Users size={40} />
          <p>No patients found matching your search.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Patient ID</th>
                  <th>Full Name</th>
                  <th>Gender / DOB</th>
                  <th>Phone & Emergency</th>
                  <th>Address</th>
                  <th>Total Visits</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <tr key={p.id}>
                    <td><b>#{p.id}</b></td>
                    <td><b>{p.name}</b></td>
                    <td>{p.gender} · {p.dob ? p.dob.slice(0, 10) : 'N/A'}</td>
                    <td>
                      <div>📞 {p.phone || 'N/A'}</div>
                      {p.emergency_contact_phone && (
                        <small style={{ color: 'var(--danger)' }}>
                          Emg: {p.emergency_contact_name} ({p.emergency_contact_phone})
                        </small>
                      )}
                    </td>
                    <td>{p.address}</td>
                    <td>{p.total_visits} visit(s)</td>
                    <td>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => onSelectPatient(p.id)}
                      >
                        Clinical Record
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// Health Worker Register Patient Form
function RegisterPatientView({ onRegistered }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    gender: 'Female',
    dob: '',
    address: '',
    language: 'Tamil',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    notes: 'Primary health care registration'
  });
  const [success, setSuccess] = useState('');
  const [err, setErr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (field) => (e) => {
    setForm({ ...form, [field]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSuccess('');
    setErr('');
    setSubmitting(true);
    try {
      const { data } = await api.post('/health-worker/patients', form);
      setSuccess(`Patient successfully registered! Patient ID #${data.id} assigned.`);
      setForm({
        name: '',
        email: '',
        phone: '',
        gender: 'Female',
        dob: '',
        address: '',
        language: 'Tamil',
        emergency_contact_name: '',
        emergency_contact_phone: '',
        notes: ''
      });
      if (onRegistered) onRegistered(data.id);
    } catch (error) {
      setErr(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Register Community Patient</h2>
          <p className="page-subtitle">Add a resident patient to the MediConnect system and assign to your area</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 700 }}>
        {success && <div className="alert alert-success">{success}</div>}
        {err && <div className="alert alert-danger">{err}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Patient Full Name *</label>
            <input
              className="form-input"
              required
              placeholder="e.g. Meenakshi Sundaram"
              value={form.name}
              onChange={handleChange('name')}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Phone Number *</label>
              <input
                className="form-input"
                required
                placeholder="e.g. 9842109870"
                value={form.phone}
                onChange={handleChange('phone')}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Email (Optional - auto-generated if blank)</label>
              <input
                type="email"
                className="form-input"
                placeholder="patient@example.com"
                value={form.email}
                onChange={handleChange('email')}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Gender</label>
              <select className="form-select" value={form.gender} onChange={handleChange('gender')}>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Date of Birth</label>
              <input
                type="date"
                className="form-input"
                value={form.dob}
                onChange={handleChange('dob')}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Language</label>
              <select className="form-select" value={form.language} onChange={handleChange('language')}>
                {LANGUAGES.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Residential Address</label>
            <input
              className="form-input"
              placeholder="e.g. 24 North Street, Perundurai"
              value={form.address}
              onChange={handleChange('address')}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Emergency Contact Name</label>
              <input
                className="form-input"
                placeholder="e.g. Murugan (Son)"
                value={form.emergency_contact_name}
                onChange={handleChange('emergency_contact_name')}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Emergency Contact Phone</label>
              <input
                className="form-input"
                placeholder="e.g. 9842109879"
                value={form.emergency_contact_phone}
                onChange={handleChange('emergency_contact_phone')}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Intake Notes</label>
            <textarea
              className="form-textarea"
              rows="2"
              placeholder="e.g. Known hypertensive, elderly care, needs monthly medicine review"
              value={form.notes}
              onChange={handleChange('notes')}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
            {submitting ? 'Registering Patient...' : 'Register & Assign Patient'}
          </button>
        </form>
      </div>
    </div>
  );
}

// Health Worker Patient Records (Clinical Observations & Vitals)
function PatientRecordsView({ patientId, onBack }) {
  const [patients, setPatients] = useState([]);
  const [selectedId, setSelectedId] = useState(patientId || '');
  const [record, setRecord] = useState(null);
  const [obsText, setObsText] = useState('');
  const [adherenceText, setAdherenceText] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/health-worker/patients').then((res) => {
      setPatients(res.data);
      if (!selectedId && res.data.length > 0) {
        setSelectedId(res.data[0].id);
      }
    });
  }, []);

  const loadRecord = (id) => {
    if (!id) return;
    setLoading(true);
    api.get(`/health-worker/patients/${id}`)
      .then((res) => setRecord(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (selectedId) loadRecord(selectedId);
  }, [selectedId]);

  const handleAddFollowup = async (e) => {
    e.preventDefault();
    if (!obsText.trim()) return;
    try {
      await api.post('/health-worker/followups', {
        patient_id: selectedId,
        observation: obsText.trim(),
        adherence_notes: adherenceText.trim()
      });
      setMsg('Observation recorded successfully.');
      setObsText('');
      setAdherenceText('');
      loadRecord(selectedId);
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Patient Records & Clinical Observations</h2>
          <p className="page-subtitle">Track health worker follow-ups, vital signs history, and doctor prescriptions</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Select Patient:</label>
          <select
            className="form-select"
            style={{ width: 'auto' }}
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                #{p.id} - {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}

      {loading || !record ? (
        <p>Loading patient clinical record...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {/* Patient Details & Doctor Prescriptions */}
          <div>
            <div className="card">
              <div className="card-title">Patient Profile</div>
              <div style={{ fontSize: '0.88rem', lineHeight: 1.6 }}>
                <div><b>Full Name:</b> {record.patient.name}</div>
                <div><b>Gender / DOB:</b> {record.patient.gender} · {record.patient.dob?.slice(0, 10)}</div>
                <div><b>Phone:</b> {record.patient.phone}</div>
                <div><b>Emergency:</b> {record.patient.emergency_contact_name} ({record.patient.emergency_contact_phone})</div>
                <div><b>Address:</b> {record.patient.address}</div>
              </div>
            </div>

            <div className="card">
              <div className="card-title">Doctor-Issued Prescriptions (Protected)</div>
              {record.prescriptions?.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No prescriptions issued by doctors yet.</p>
              ) : (
                record.prescriptions.map((rx) => (
                  <div key={rx.id} style={{ background: 'var(--bg-subtle)', padding: 12, borderRadius: 8, marginBottom: 10 }}>
                    <b>Rx #{rx.id} - Dr. {rx.doctor_name}</b> <small>({rx.created_at.slice(0, 10)})</small>
                    <div style={{ fontSize: '0.82rem', marginTop: 4 }}>
                      <b>Diagnosis:</b> {rx.diagnosis || 'Clinical evaluation'}
                    </div>
                    {rx.items?.map((it) => (
                      <div key={it.id} style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        • {it.medicine_name} ({it.dosage}) - {it.frequency}×/day
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Observations and Followups */}
          <div>
            <div className="card">
              <div className="card-title">Record Health Worker Observation</div>
              <form onSubmit={handleAddFollowup}>
                <div className="form-group">
                  <label className="form-label">Clinical Observation / Symptoms Noted *</label>
                  <textarea
                    className="form-textarea"
                    rows="3"
                    placeholder="e.g. Visited patient today. Blood pressure stable. No dizziness reported."
                    value={obsText}
                    onChange={(e) => setObsText(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Medicine Adherence Observation</label>
                  <input
                    className="form-input"
                    placeholder="e.g. Verified blister pack; morning doses taken properly."
                    value={adherenceText}
                    onChange={(e) => setAdherenceText(e.target.value)}
                  />
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                  Save Clinical Observation
                </button>
              </form>
            </div>

            <div className="card">
              <div className="card-title">Recorded Observation Log</div>
              {record.followups?.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No observation logs recorded yet.</p>
              ) : (
                record.followups.map((f) => (
                  <div key={f.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 10, marginBottom: 10 }}>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{f.created_at.slice(0, 16)}</div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{f.observation}</div>
                    {f.adherence_notes && (
                      <div style={{ fontSize: '0.82rem', color: 'var(--teal)' }}>
                        Adherence: {f.adherence_notes}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Health Worker Home Visit Records (Vitals Logging & History)
function HomeVisitsView() {
  const [visits, setVisits] = useState([]);
  const [patients, setPatients] = useState([]);
  const [showModal, setShowModal] = useState(false);

  // Form state
  const [patientId, setPatientId] = useState('');
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split('T')[0]);
  const [bp, setBp] = useState('120/80 mmHg');
  const [pulse, setPulse] = useState('72 bpm');
  const [sugar, setSugar] = useState('110 mg/dL');
  const [temp, setTemp] = useState('98.6°F');
  const [observations, setObservations] = useState('');
  const [nextDate, setNextDate] = useState('');
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = () => {
    api.get('/health-worker/home-visits').then((res) => setVisits(res.data));
    api.get('/health-worker/patients').then((res) => {
      setPatients(res.data);
      if (res.data.length > 0 && !patientId) {
        setPatientId(res.data[0].id);
      }
    });
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveVisit = async (e) => {
    e.preventDefault();
    setMsg('');
    setErr('');
    if (!patientId || !observations.trim()) {
      setErr('Please select a patient and enter clinical observations.');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/health-worker/home-visits', {
        patient_id: patientId,
        visit_date: visitDate,
        blood_pressure: bp,
        pulse,
        blood_sugar: sugar,
        temperature: temp,
        observations: observations.trim(),
        next_followup_date: nextDate || null
      });
      setMsg('Home visit record and vitals successfully saved to MySQL!');
      setShowModal(false);
      setObservations('');
      loadData();
    } catch (error) {
      setErr(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Home Visit Records & Vitals</h2>
          <p className="page-subtitle">Log field visits, measure vital signs, and schedule follow-ups</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <PlusCircle size={16} /> Log New Home Visit
        </button>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}

      {/* Modal */}
      {showModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: 650 }}>
            <div className="modal-header">
              <h3>Log Home Visit & Vital Signs</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>

            {err && <div className="alert alert-danger">{err}</div>}

            <form onSubmit={handleSaveVisit}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Patient *</label>
                  <select
                    className="form-select"
                    value={patientId}
                    onChange={(e) => setPatientId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Patient --</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>#{p.id} - {p.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Visit Date *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={visitDate}
                    onChange={(e) => setVisitDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="card" style={{ background: 'var(--bg-subtle)' }}>
                <b>Vital Signs Measurements</b>
                <div className="form-row" style={{ marginTop: 8 }}>
                  <div className="form-group">
                    <label className="form-label">Blood Pressure</label>
                    <input
                      className="form-input"
                      placeholder="e.g. 120/80 mmHg"
                      value={bp}
                      onChange={(e) => setBp(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Pulse / Heart Rate</label>
                    <input
                      className="form-input"
                      placeholder="e.g. 72 bpm"
                      value={pulse}
                      onChange={(e) => setPulse(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Blood Sugar</label>
                    <input
                      className="form-input"
                      placeholder="e.g. 110 mg/dL"
                      value={sugar}
                      onChange={(e) => setSugar(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Temperature</label>
                    <input
                      className="form-input"
                      placeholder="e.g. 98.6°F"
                      value={temp}
                      onChange={(e) => setTemp(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Clinical Observations & Patient Feedback *</label>
                <textarea
                  className="form-textarea"
                  rows="3"
                  placeholder="e.g. Patient is active, diet normal, taking prescribed tablets on time."
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Next Scheduled Follow-up Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={nextDate}
                  onChange={(e) => setNextDate(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 14 }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save Home Visit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Visits Table */}
      <div className="card" style={{ padding: 0 }}>
        {visits.length === 0 ? (
          <div className="empty-state">
            <HomeIcon size={40} />
            <p>No home visits recorded yet.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Visit Date</th>
                  <th>Patient</th>
                  <th>Vitals Recorded</th>
                  <th>Observations</th>
                  <th>Next Follow-up</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((v) => (
                  <tr key={v.id}>
                    <td><b>{v.visit_date.slice(0, 10)}</b></td>
                    <td>
                      <b>{v.patient_name}</b>
                      <br />
                      <small>{v.patient_phone}</small>
                    </td>
                    <td>
                      <div>BP: {v.blood_pressure || 'N/A'}</div>
                      <div>Pulse: {v.pulse || 'N/A'}</div>
                      <div>Sugar: {v.blood_sugar || 'N/A'}</div>
                      <div>Temp: {v.temperature || 'N/A'}</div>
                    </td>
                    <td style={{ maxWidth: 280 }}>{v.observations}</td>
                    <td>
                      {v.next_followup_date ? (
                        <span className="badge badge-Confirmed">{v.next_followup_date.slice(0, 10)}</span>
                      ) : (
                        'None'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Health Worker Medicine Follow-up View
function MedicineFollowupView() {
  const [adherence, setAdherence] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/health-worker/medicine-adherence')
      .then((res) => setAdherence(res.data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Medicine Follow-up & Adherence</h2>
          <p className="page-subtitle">Monitor whether assigned community patients are adhering to doctor prescriptions</p>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <p style={{ padding: 20 }}>Loading adherence data...</p>
        ) : adherence.length === 0 ? (
          <div className="empty-state">
            <Pill size={40} />
            <p>No active prescription reminders found for assigned patients.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Medicine</th>
                  <th>Dosage</th>
                  <th>Scheduled Time</th>
                  <th>Total Doses Taken</th>
                  <th>Reminder Status</th>
                </tr>
              </thead>
              <tbody>
                {adherence.map((row, idx) => (
                  <tr key={idx}>
                    <td><b>{row.patient_name}</b></td>
                    <td>{row.medicine_name}</td>
                    <td>{row.dosage}</td>
                    <td>⏰ {row.remind_time.slice(0, 5)}</td>
                    <td>
                      <b>{row.taken_count} dose(s) logged</b>
                    </td>
                    <td>
                      <span className={`badge badge-${row.reminder_status === 'Active' ? 'Confirmed' : 'Cancelled'}`}>
                        {row.reminder_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 4. ADMIN DASHBOARD VIEW
// ==========================================

function AdminView() {
  const [stats, setStats] = useState({});
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      api.get('/admin/dashboard'),
      api.get('/admin/users')
    ])
      .then(([sRes, uRes]) => {
        setStats(sRes.data);
        setUsers(uRes.data);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleDeleteUser = async (id) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await api.delete(`/admin/users/${id}`);
      loadData();
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Hospital Administration HQ</h2>
          <p className="page-subtitle">System metrics, user accounts, and database overview</p>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><Users size={24} /></div>
          <div>
            <div className="stat-value">{stats.totalUsers || 0}</div>
            <div className="stat-label">Total Users</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green"><User size={24} /></div>
          <div>
            <div className="stat-value">{stats.totalPatients || 0}</div>
            <div className="stat-label">Registered Patients</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon teal"><Stethoscope size={24} /></div>
          <div>
            <div className="stat-value">{stats.totalDoctors || 0}</div>
            <div className="stat-label">Doctors</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon amber"><ClipboardList size={24} /></div>
          <div>
            <div className="stat-value">{stats.totalHealthWorkers || 0}</div>
            <div className="stat-label">Health Workers</div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="card-title" style={{ padding: '16px 20px', margin: 0 }}>
          User Directory ({users.length})
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Created At</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>#{u.id}</td>
                  <td><b>{u.name}</b></td>
                  <td>{u.email}</td>
                  <td>{u.phone || 'N/A'}</td>
                  <td><span className={`role-pill ${u.role}`}>{u.role}</span></td>
                  <td>{u.created_at?.slice(0, 10)}</td>
                  <td>
                    {u.role !== 'ADMIN' && (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDeleteUser(u.id)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// MAIN APPLICATION ROOT
// ==========================================

export default function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  });

  const [currentTab, setCurrentTab] = useState('dashboard');
  const [targetContext, setTargetContext] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Patient Overdue Medicine State & Detection
  const [patientReminders, setPatientReminders] = useState([]);
  const [dismissedOverdueIds, setDismissedOverdueIds] = useState([]);
  const [showOverdueModal, setShowOverdueModal] = useState(true);

  const loadPatientReminders = async () => {
    if (!currentUser || currentUser.role !== 'PATIENT') return;
    try {
      const { data } = await api.get('/reminders');
      setPatientReminders(data);
    } catch (err) {
      console.error('Error fetching patient reminders:', err);
    }
  };

  // Check overdue doses when page is open, refreshed, and on window focus / visibility change
  useEffect(() => {
    if (!currentUser || currentUser.role !== 'PATIENT') return;
    loadPatientReminders();

    const interval = setInterval(loadPatientReminders, 15000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadPatientReminders();
      }
    };
    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', loadPatientReminders);

    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', loadPatientReminders);
    };
  }, [currentUser]);

  // Helper to determine if a dose is overdue
  const isDoseOverdue = (rem) => {
    if (!rem || rem.status !== 'Active') return false;
    if (rem.today_status === 'Taken') return false;
    if (!rem.remind_time) return false;
    const now = new Date();
    const [h, m] = rem.remind_time.split(':').map(Number);
    const scheduled = new Date();
    scheduled.setHours(h, m, 0, 0);
    return now > scheduled;
  };

  const overdueDoses = currentUser?.role === 'PATIENT' ? patientReminders.filter(isDoseOverdue) : [];
  const pendingAlertDoses = overdueDoses.filter((d) => !dismissedOverdueIds.includes(d.id));

  const handleConfirmTaken = async (reminderId) => {
    try {
      await api.post(`/reminders/${reminderId}/take`);
      await loadPatientReminders();
      setDismissedOverdueIds((prev) => prev.filter((id) => id !== reminderId));
    } catch (err) {
      alert(getErrorMessage(err));
    }
  };

  const handleNotTakenYet = (reminderId) => {
    // Keep dose strictly marked Overdue, do NOT mark as taken!
    setDismissedOverdueIds((prev) => (prev.includes(reminderId) ? prev : [...prev, reminderId]));
  };

  const handleTabChange = (tabId) => {
    if (currentUser?.role === 'PATIENT' && overdueDoses.length > 0) {
      const isEssential = [
        'find-doctor',
        'book-appointment',
        'my-appointments',
        'teleconsultation',
        'medical-reports',
        'my-prescriptions',
        'medicine-tracker',
        'nearby-hospitals'
      ].includes(tabId);

      if (!isEssential) {
        // Enforce restriction for non-essential dashboard activities
        setDismissedOverdueIds([]);
        setShowOverdueModal(true);
      }
    }
    setCurrentTab(tabId);
  };

  // Load notifications
  useEffect(() => {
    if (!currentUser) return;
    api.get('/notifications')
      .then((res) => setNotifications(res.data))
      .catch((err) => console.error(err));
  }, [currentUser, currentTab]);

  const handleLogout = () => {
    localStorage.clear();
    setCurrentUser(null);
    setCurrentTab('dashboard');
  };

  // Dedicated mobile payment information page (accessible directly via QR scan without login)
  const isPaymentPage = typeof window !== 'undefined' && (
    window.location.pathname.startsWith('/payment-info') ||
    window.location.search.includes('payment') ||
    window.location.hash.includes('payment-info')
  );

  if (isPaymentPage) {
    return <ConsultationPaymentInfoPage />;
  }

  if (!currentUser) {
    return <AuthView onLogin={(user) => { setCurrentUser(user); setCurrentTab('dashboard'); }} />;
  }

  // Define tab navigation per user role
  const NAVIGATION_CONFIG = {
    PATIENT: [
      { id: 'dashboard', label: 'Dashboard', icon: HomeIcon },
      { id: 'ai-health', label: 'AI Health Support', icon: Activity },
      { id: 'find-doctor', label: 'Find a Doctor', icon: Stethoscope },
      { id: 'book-appointment', label: 'Book Appointment', icon: Calendar },
      { id: 'my-appointments', label: 'My Appointments', icon: Clock },
      { id: 'teleconsultation', label: 'Teleconsultation', icon: Video },
      { id: 'medical-reports', label: 'My Medical Reports', icon: FileText },
      { id: 'my-prescriptions', label: 'My Prescriptions', icon: FileText },
      { id: 'medicine-tracker', label: 'Medicine Tracker', icon: Pill },
      { id: 'nearby-hospitals', label: 'Nearby Hospitals', icon: MapPin },
      { id: 'my-profile', label: 'My Profile', icon: User }
    ],
    DOCTOR: [
      { id: 'dashboard', label: 'Dashboard', icon: HomeIcon },
      { id: 'my-patients', label: 'My Patients', icon: Users },
      { id: 'patient-reports', label: 'Patient Medical Reports', icon: FileText },
      { id: 'appointments', label: 'Appointments', icon: Calendar },
      { id: 'availability', label: 'Availability', icon: Clock },
      { id: 'teleconsultation', label: 'Teleconsultation', icon: Video },
      { id: 'prescriptions', label: 'Prescriptions', icon: FileText },
      { id: 'my-profile', label: 'My Profile', icon: User }
    ],
    HEALTH_WORKER: [
      { id: 'dashboard', label: 'Dashboard', icon: HomeIcon },
      { id: 'my-patients', label: 'My Patients', icon: Users },
      { id: 'patient-reports', label: 'Patient Medical Reports', icon: FileText },
      { id: 'register-patient', label: 'Register Patient', icon: PlusCircle },
      { id: 'patient-records', label: 'Patient Records', icon: ClipboardList },
      { id: 'appointments', label: 'Appointments', icon: Calendar },
      { id: 'teleconsultation', label: 'Doctor Teleconsultation', icon: Video },
      { id: 'medicine-followup', label: 'Medicine Follow-up', icon: Pill },
      { id: 'home-visits', label: 'Home Visit Records', icon: HomeIcon },
      { id: 'my-profile', label: 'My Profile', icon: User }
    ],
    ADMIN: [
      { id: 'dashboard', label: 'Dashboard', icon: HomeIcon },
      { id: 'appointments', label: 'Appointments', icon: Calendar },
      { id: 'nearby-hospitals', label: 'Hospitals', icon: MapPin },
      { id: 'my-profile', label: 'My Profile', icon: User }
    ]
  };

  const navItems = NAVIGATION_CONFIG[currentUser.role] || NAVIGATION_CONFIG.PATIENT;

  // Render content according to role and currentTab
  const renderContent = () => {
    // Shared tabs
    if (currentTab === 'my-profile') {
      return (
        <ProfileView
          user={currentUser}
          onProfileUpdated={() => {
            api.get('/auth/me').then((res) => {
              setCurrentUser({ ...currentUser, name: res.data.name });
              localStorage.setItem('user', JSON.stringify({ ...currentUser, name: res.data.name }));
            });
          }}
        />
      );
    }

    if (currentTab === 'teleconsultation') {
      return (
        <TeleconsultationView
          appointmentId={targetContext.appointmentId}
          user={currentUser}
          onEndCall={() => handleTabChange('dashboard')}
          initialMode={targetContext.callMode || 'video'}
        />
      );
    }

    if (currentUser.role === 'PATIENT') {
      switch (currentTab) {
        case 'dashboard':
          return (
            <PatientHome
              user={currentUser}
              onNavigate={(tab, ctx = {}) => {
                setTargetContext(ctx);
                handleTabChange(tab);
              }}
              onOpenOverdueModal={() => {
                setDismissedOverdueIds([]);
                setShowOverdueModal(true);
              }}
            />
          );
        case 'ai-health':
          return (
            <AIHealthSupportView
              onNavigate={(tab, ctx = {}) => {
                setTargetContext(ctx);
                handleTabChange(tab);
              }}
            />
          );
        case 'find-doctor':
          return (
            <FindDoctorView
              onSelectDoctorToBook={(docId) => {
                setTargetContext({ doctorId: docId });
                handleTabChange('book-appointment');
              }}
            />
          );
        case 'book-appointment':
          return (
            <BookAppointmentView
              preselectedDoctorId={targetContext.doctorId}
              onAppointmentBooked={() => handleTabChange('my-appointments')}
            />
          );
        case 'my-appointments':
          return (
            <MyAppointmentsView
              user={currentUser}
              onJoinTeleconsult={(aptId, mode) => {
                setTargetContext({ appointmentId: aptId, callMode: mode || 'video' });
                handleTabChange('teleconsultation');
              }}
            />
          );
        case 'medical-reports':
          return <PatientMedicalReportsView />;
        case 'my-prescriptions':
          return <MyPrescriptionsView />;
        case 'medicine-tracker':
          return <MedicineTrackerView onReminderUpdated={loadPatientReminders} />;
        case 'nearby-hospitals':
          return <NearbyHospitalsView />;
        default:
          return (
            <PatientHome
              user={currentUser}
              onNavigate={handleTabChange}
              onOpenOverdueModal={() => {
                setDismissedOverdueIds([]);
                setShowOverdueModal(true);
              }}
            />
          );
      }
    }

    if (currentUser.role === 'DOCTOR') {
      switch (currentTab) {
        case 'dashboard':
          return (
            <DoctorDashboardHome
              user={currentUser}
              onNavigate={(tab, ctx = {}) => {
                setTargetContext(ctx);
                setCurrentTab(tab);
              }}
            />
          );
        case 'my-patients':
          return <DoctorPatientsView />;
        case 'patient-reports':
          return (
            <DoctorPatientReportsView
              onNavigateToConsultation={(aptId) => {
                setTargetContext({ appointmentId: aptId, callMode: 'video' });
                setCurrentTab('teleconsultation');
              }}
            />
          );
        case 'appointments':
          return (
            <DoctorAppointmentsView
              onPrescribe={(aptId, pId, pName) => {
                setTargetContext({ appointmentId: aptId, patientId: pId, patientName: pName });
                setCurrentTab('prescriptions');
              }}
              onJoinTeleconsult={(aptId, mode) => {
                setTargetContext({ appointmentId: aptId, callMode: mode || 'video' });
                setCurrentTab('teleconsultation');
              }}
            />
          );
        case 'availability':
          return <DoctorAvailabilityView />;
        case 'prescriptions':
          return (
            <DoctorPrescriptionsView
              initialAppointmentId={targetContext.appointmentId}
              initialPatientId={targetContext.patientId}
              initialPatientName={targetContext.patientName}
            />
          );
        default:
          return <DoctorDashboardHome user={currentUser} onNavigate={setCurrentTab} />;
      }
    }

    if (currentUser.role === 'HEALTH_WORKER') {
      switch (currentTab) {
        case 'dashboard':
          return (
            <HealthWorkerHome
              user={currentUser}
              onNavigate={(tab, ctx = {}) => {
                setTargetContext(ctx);
                setCurrentTab(tab);
              }}
            />
          );
        case 'my-patients':
          return <HealthWorkerPatientsView onSelectPatient={(pId) => { setTargetContext({ patientId: pId }); setCurrentTab('patient-records'); }} />;
        case 'patient-reports':
          return <HealthWorkerPatientReportsView />;
        case 'register-patient':
          return <RegisterPatientView onRegistered={(pId) => { setTargetContext({ patientId: pId }); setCurrentTab('my-patients'); }} />;
        case 'patient-records':
          return <PatientRecordsView patientId={targetContext.patientId} onBack={() => setCurrentTab('my-patients')} />;
        case 'appointments':
          return <HealthWorkerAppointmentsView user={currentUser} onJoinTeleconsult={(aptId, mode) => { setTargetContext({ appointmentId: aptId, callMode: mode || 'video' }); setCurrentTab('teleconsultation'); }} />;
        case 'medicine-followup':
          return <MedicineFollowupView />;
        case 'home-visits':
          return <HomeVisitsView />;
        default:
          return <HealthWorkerHome user={currentUser} onNavigate={setCurrentTab} />;
      }
    }

    if (currentUser.role === 'ADMIN') {
      switch (currentTab) {
        case 'dashboard':
          return <AdminView />;
        case 'appointments':
          return <DoctorAppointmentsView onPrescribe={() => {}} onJoinTeleconsult={() => {}} />;
        case 'nearby-hospitals':
          return <NearbyHospitalsView />;
        default:
          return <AdminView />;
      }
    }

    return null;
  };

  return (
    <div>
      {/* Top Navigation Bar */}
      <header className="topbar">
        <div className="topbar-left">
          <div className="brand">
            <div className="brand-icon">
              <HeartPulse size={22} />
            </div>
            <span>MediConnect AI</span>
          </div>
          <span className="academic-badge">Academic Healthcare Demo</span>
        </div>

        <div className="topbar-right">
          {/* Notification bell popover */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              style={{ position: 'relative', borderRadius: '50%', width: 36, height: 36, padding: 0 }}
              onClick={() => setShowNotifications(!showNotifications)}
              title="Notifications"
            >
              <Bell size={18} />
              {notifications.filter((n) => !n.is_read).length > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    background: 'var(--danger)',
                    color: '#fff',
                    borderRadius: '50%',
                    width: 16,
                    height: 16,
                    fontSize: '0.65rem',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {notifications.filter((n) => !n.is_read).length}
                </span>
              )}
            </button>

            {showNotifications && (
              <div
                className="card"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 45,
                  width: 320,
                  zIndex: 50,
                  boxShadow: 'var(--shadow-lg)',
                  padding: 14,
                  maxHeight: 380,
                  overflowY: 'auto'
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 8, fontSize: '0.9rem' }}>Notifications</div>
                {notifications.length === 0 ? (
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No notifications.</p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      style={{
                        padding: '8px 10px',
                        background: 'var(--bg-subtle)',
                        borderRadius: 6,
                        marginBottom: 6,
                        fontSize: '0.82rem'
                      }}
                    >
                      {n.message}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          <LanguageSelector compact />
          <span className={`role-pill ${currentUser.role}`}>{currentUser.role.replace('_', ' ')}</span>

          <div className="user-profile-badge">
            <div className="user-avatar-circle">
              {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <span style={{ fontSize: '0.88rem', fontWeight: 600 }}>{currentUser.name}</span>
          </div>

          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={handleLogout}
            title="Logout"
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </header>

      {/* Main Dashboard Layout */}
      <div className="dashboard-wrapper">
        <aside className="sidebar">
          <div className="sidebar-menu">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              const isPatient = currentUser.role === 'PATIENT';
              const hasOverdue = isPatient && overdueDoses.length > 0;
              const isEssential = [
                'find-doctor',
                'book-appointment',
                'my-appointments',
                'teleconsultation',
                'my-prescriptions',
                'medicine-tracker',
                'nearby-hospitals'
              ].includes(item.id);

              return (
                <button
                  key={item.id}
                  className={`sidebar-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleTabChange(item.id)}
                  style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </div>
                  {item.id === 'medicine-tracker' && hasOverdue && (
                    <span
                      style={{
                        background: '#dc2626',
                        color: '#fff',
                        fontSize: '0.7rem',
                        fontWeight: 800,
                        padding: '1px 6px',
                        borderRadius: 10
                      }}
                      title={`${overdueDoses.length} overdue doses`}
                    >
                      {overdueDoses.length}
                    </span>
                  )}
                  {hasOverdue && !isEssential && (
                    <span
                      style={{
                        fontSize: '0.72rem',
                        color: '#ef4444',
                        fontWeight: 700
                      }}
                      title="Activities restricted until overdue medicine is confirmed"
                    >
                      ⚠️
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button className="sidebar-item sidebar-logout" onClick={handleLogout}>
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </aside>

        <main className="main-content">
          {/* Global Patient Overdue Reminder Banner */}
          {currentUser.role === 'PATIENT' && overdueDoses.length > 0 && (
            <div
              style={{
                background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                border: '1px solid #fca5a5',
                borderLeft: '6px solid #dc2626',
                borderRadius: 'var(--radius-md)',
                padding: '14px 20px',
                marginBottom: 20,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 14,
                boxShadow: '0 4px 12px rgba(220, 38, 38, 0.08)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: '50%',
                    background: '#dc2626',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 0 0 4px rgba(220, 38, 38, 0.15)'
                  }}
                >
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, color: '#991b1b', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>MEDICINE TIME MISSED — {overdueDoses.length} {overdueDoses.length === 1 ? 'DOSE' : 'DOSES'} OVERDUE</span>
                  </div>
                  <div style={{ fontSize: '0.84rem', color: '#7f1d1d', marginTop: 3 }}>
                    {overdueDoses.map((d) => `${d.medicine_name} (${d.remind_time.slice(0, 5)})`).join(' · ')}
                    {' · '}
                    <span style={{ fontWeight: 600 }}>Normal dashboard activities are restricted until confirmed. Essential healthcare services remain available.</span>
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}
                  onClick={() => {
                    setDismissedOverdueIds([]);
                    setShowOverdueModal(true);
                  }}
                >
                  <Pill size={16} /> Confirm Doses Now
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  style={{ borderColor: '#f87171', color: '#991b1b', fontWeight: 700 }}
                  onClick={() => handleTabChange('medicine-tracker')}
                >
                  Medicine Tracker
                </button>
              </div>
            </div>
          )}

          {renderContent()}
        </main>
      </div>

      {/* 2. BIG OVERDUE ALERT MODAL */}
      {currentUser.role === 'PATIENT' && showOverdueModal && pendingAlertDoses.length > 0 && (() => {
        const currentDose = pendingAlertDoses[0];
        const totalOverdue = overdueDoses.length;
        const currentIdx = overdueDoses.findIndex((d) => d.id === currentDose.id);

        return (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(15, 23, 42, 0.8)',
              backdropFilter: 'blur(5px)',
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16
            }}
          >
            <div
              className="card"
              style={{
                width: '100%',
                maxWidth: 550,
                background: '#ffffff',
                borderRadius: 18,
                border: '2px solid #ef4444',
                boxShadow: '0 25px 50px -12px rgba(220, 38, 38, 0.4)',
                padding: 0,
                overflow: 'hidden'
              }}
            >
              {/* Header with warning icon and heading */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                  borderBottom: '2px solid #fecaca',
                  padding: '20px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 14
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: '50%',
                      background: '#dc2626',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 0 0 6px rgba(220, 38, 38, 0.2)',
                      flexShrink: 0
                    }}
                  >
                    <AlertTriangle size={28} />
                  </div>
                  <div>
                    <h2
                      style={{
                        fontSize: '1.45rem',
                        fontWeight: 900,
                        color: '#b91c1c',
                        margin: 0,
                        letterSpacing: '0.5px'
                      }}
                    >
                      MEDICINE TIME MISSED!
                    </h2>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#991b1b', fontWeight: 600 }}>
                      Scheduled dose time has passed · Patient Confirmation Required
                    </p>
                  </div>
                </div>
                {totalOverdue > 1 && (
                  <span
                    style={{
                      background: '#b91c1c',
                      color: '#ffffff',
                      fontSize: '0.78rem',
                      fontWeight: 800,
                      padding: '4px 10px',
                      borderRadius: 20,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Dose {currentIdx + 1} of {totalOverdue}
                  </span>
                )}
              </div>

              {/* Modal Body */}
              <div style={{ padding: '24px 26px' }}>
                {/* Medicine Details Box */}
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: 12,
                    padding: '16px 18px',
                    marginBottom: 16
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Pill size={22} color="var(--primary)" />
                        <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)' }}>
                          {currentDose.medicine_name}
                        </span>
                        <span className="badge badge-Completed" style={{ fontSize: '0.8rem' }}>
                          {currentDose.dosage}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        Prescribing Doctor: <b>{currentDose.doctor_name || 'Attending Physician'}</b>
                      </div>
                    </div>
                    <div
                      style={{
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        color: '#dc2626',
                        fontWeight: 800,
                        fontSize: '0.88rem',
                        padding: '6px 12px',
                        borderRadius: 8,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <Clock size={16} />
                      <span>Scheduled: {currentDose.remind_time.slice(0, 5)} (Overdue)</span>
                    </div>
                  </div>

                  {currentDose.instructions && (
                    <div
                      style={{
                        marginTop: 12,
                        paddingTop: 10,
                        borderTop: '1px dashed #e2e8f0',
                        fontSize: '0.86rem',
                        color: '#475569'
                      }}
                    >
                      <b>Instructions:</b> {currentDose.instructions}
                    </div>
                  )}
                </div>

                {/* Message */}
                <p style={{ fontSize: '0.94rem', color: '#334155', lineHeight: 1.55, margin: '0 0 20px 0' }}>
                  Your scheduled medicine time has passed. Please confirm your medicine status immediately to ensure treatment continuity and clinical safety.
                </p>

                {/* Multiple Doses Queue List */}
                {totalOverdue > 1 && (
                  <div style={{ marginBottom: 18, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', fontSize: '0.82rem', color: '#92400e' }}>
                    <b>All Overdue Doses ({totalOverdue}):</b>
                    <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {overdueDoses.map((d) => (
                        <span
                          key={d.id}
                          style={{
                            background: d.id === currentDose.id ? '#dc2626' : '#fef3c7',
                            color: d.id === currentDose.id ? '#ffffff' : '#78350f',
                            padding: '3px 9px',
                            borderRadius: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4
                          }}
                          onClick={() => {
                            setDismissedOverdueIds((prev) => prev.filter((id) => id !== d.id));
                          }}
                        >
                          {d.medicine_name} ({d.remind_time.slice(0, 5)})
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Large Green 'I HAVE TAKEN IT' and Secondary 'NOT TAKEN YET' */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button
                    type="button"
                    className="btn btn-success"
                    style={{
                      width: '100%',
                      height: 52,
                      fontSize: '1.08rem',
                      fontWeight: 800,
                      background: '#16a34a',
                      borderColor: '#15803d',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 10,
                      boxShadow: '0 4px 14px rgba(22, 163, 74, 0.35)',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleConfirmTaken(currentDose.id)}
                  >
                    <CheckCircle2 size={22} />
                    <span>I HAVE TAKEN IT</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{
                      width: '100%',
                      height: 42,
                      fontSize: '0.92rem',
                      fontWeight: 700,
                      color: '#64748b',
                      borderColor: '#cbd5e1',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleNotTakenYet(currentDose.id)}
                  >
                    NOT TAKEN YET
                  </button>
                </div>

                {/* Healthcare Safety Exception Note */}
                <div
                  style={{
                    marginTop: 18,
                    padding: '10px 14px',
                    background: '#f0fdf4',
                    border: '1px solid #bbf7d0',
                    borderRadius: 8,
                    fontSize: '0.78rem',
                    color: '#166534',
                    lineHeight: 1.45,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}
                >
                  <ShieldAlert size={18} style={{ flexShrink: 0, color: '#16a34a' }} />
                  <span>
                    <b>Healthcare Safety Exception:</b> Emergency assistance (112 / 108), contacting your doctor, teleconsultation, and clinical prescriptions remain accessible at all times.
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
