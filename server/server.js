import http from 'http';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import multer from 'multer';
import db from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

const server = http.createServer(app);

// WebRTC Teleconsultation Signaling via WebSockets
const wss = new WebSocketServer({ server, path: '/ws' });
const consultationRooms = new Map(); // roomId -> Map<ws, { id, name, role }

wss.on('connection', (ws) => {
  let currentRoomId = null;
  let currentUser = null;
  ws.isAlive = true;

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw);
      switch (msg.type) {
        case 'join': {
          const { roomId, user, token } = msg;
          if (!roomId || !user) return;
          const targetRoomId = String(roomId);

          let verifiedUser = user;
          if (token) {
            try {
              const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mediconnect_ai_jwt_secret_key_2026_secure');
              if (decoded) verifiedUser = decoded;
            } catch (err) {
              console.warn('WebSocket token verification note:', err.message);
            }
          }

          // Authorize consultation room access
          try {
            const hasAccess = await checkConsultationAccess(verifiedUser, targetRoomId);
            if (!hasAccess) {
              ws.send(JSON.stringify({
                type: 'error',
                message: 'Unauthorized: You are not assigned to this consultation session.'
              }));
              return;
            }
          } catch (authErr) {
            console.error('Room authorization check failed:', authErr.message);
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Failed to verify consultation room access.'
            }));
            return;
          }

          // If this connection was already joined to a different room, clean up previous room first
          if (currentRoomId && currentRoomId !== targetRoomId && consultationRooms.has(currentRoomId)) {
            const oldRoom = consultationRooms.get(currentRoomId);
            oldRoom.delete(ws);
            if (oldRoom.size === 0) {
              consultationRooms.delete(currentRoomId);
            } else {
              oldRoom.forEach((peer, peerWs) => {
                if (peerWs.readyState === WebSocket.OPEN) {
                  peerWs.send(JSON.stringify({
                    type: 'peer-left',
                    peer: currentUser ? { id: currentUser.id, name: currentUser.name, role: currentUser.role } : null
                  }));
                }
              });
            }
          }

          currentRoomId = targetRoomId;
          currentUser = verifiedUser;

          if (!consultationRooms.has(currentRoomId)) {
            consultationRooms.set(currentRoomId, new Map());
          }
          const room = consultationRooms.get(currentRoomId);

          // Notify existing peers that this user joined
          room.forEach((peer, peerWs) => {
            if (peerWs !== ws && peerWs.readyState === WebSocket.OPEN) {
              peerWs.send(JSON.stringify({
                type: 'peer-joined',
                peer: { id: verifiedUser.id, name: verifiedUser.name, role: verifiedUser.role }
              }));
            }
          });

          // Register this peer
          room.set(ws, { id: verifiedUser.id, name: verifiedUser.name, role: verifiedUser.role });

          // Send current peers to the newly joined user
          const existingPeers = [];
          room.forEach((peer, peerWs) => {
            if (peerWs !== ws) {
              existingPeers.push({ id: peer.id, name: peer.name, role: peer.role });
            }
          });

          ws.send(JSON.stringify({
            type: 'room-info',
            roomId: currentRoomId,
            peers: existingPeers
          }));
          break;
        }

        case 'signal': {
          if (!currentRoomId || !consultationRooms.has(currentRoomId)) return;
          const room = consultationRooms.get(currentRoomId);
          room.forEach((peer, peerWs) => {
            if (peerWs !== ws && peerWs.readyState === WebSocket.OPEN) {
              peerWs.send(JSON.stringify({
                type: 'signal',
                sender: currentUser ? { id: currentUser.id, name: currentUser.name, role: currentUser.role } : null,
                signalData: msg.signalData
              }));
            }
          });
          break;
        }

        case 'media-toggle': {
          if (!currentRoomId || !consultationRooms.has(currentRoomId)) return;
          const room = consultationRooms.get(currentRoomId);
          room.forEach((peer, peerWs) => {
            if (peerWs !== ws && peerWs.readyState === WebSocket.OPEN) {
              peerWs.send(JSON.stringify({
                type: 'media-toggle',
                sender: currentUser ? { id: currentUser.id, name: currentUser.name, role: currentUser.role } : null,
                mediaType: msg.mediaType,
                enabled: msg.enabled
              }));
            }
          });
          break;
        }

        case 'chat': {
          if (!currentRoomId || !consultationRooms.has(currentRoomId)) return;
          const room = consultationRooms.get(currentRoomId);
          room.forEach((peer, peerWs) => {
            if (peerWs !== ws && peerWs.readyState === WebSocket.OPEN) {
              peerWs.send(JSON.stringify({
                type: 'chat',
                message: msg.message
              }));
            }
          });
          break;
        }

        case 'call-ended': {
          if (!currentRoomId || !consultationRooms.has(currentRoomId)) return;
          const room = consultationRooms.get(currentRoomId);
          room.forEach((peer, peerWs) => {
            if (peerWs !== ws && peerWs.readyState === WebSocket.OPEN) {
              peerWs.send(JSON.stringify({
                type: 'call-ended',
                by: currentUser
              }));
            }
          });
          break;
        }

        default:
          break;
      }
    } catch (e) {
      console.error('Signaling error:', e.message);
    }
  });

  const handleDisconnect = () => {
    if (currentRoomId && consultationRooms.has(currentRoomId)) {
      const room = consultationRooms.get(currentRoomId);
      room.delete(ws);
      if (room.size === 0) {
        consultationRooms.delete(currentRoomId);
      } else {
        room.forEach((peer, peerWs) => {
          if (peerWs.readyState === WebSocket.OPEN) {
            peerWs.send(JSON.stringify({
              type: 'peer-left',
              peer: currentUser ? { id: currentUser.id, name: currentUser.name, role: currentUser.role } : null
            }));
          }
        });
      }
    }
  };

  ws.on('close', handleDisconnect);
  ws.on('error', handleDisconnect);
});

const pingInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

wss.on('close', () => {
  clearInterval(pingInterval);
});

// Helper for DB queries
const q = async (sql, params = []) => {
  const [rows] = await db.query(sql, params);
  return rows;
};

// Check consultation access permissions across roles (Patient, Doctor, Health Worker, Admin)
const checkConsultationAccess = async (user, appointmentId) => {
  if (!user || !appointmentId) return null;
  const rows = await q(
    `SELECT a.id, a.patient_id, a.doctor_id, d.user_id doc_uid, a.status, a.date, a.time, a.meeting_status
     FROM appointments a
     JOIN doctors d ON d.id = a.doctor_id
     WHERE a.id = ?`,
    [appointmentId]
  );
  if (rows.length === 0) return null;
  const apt = rows[0];

  if (user.role === 'ADMIN') return apt;
  if (user.role === 'PATIENT' && apt.patient_id === user.id) return apt;
  if (user.role === 'DOCTOR' && apt.doc_uid === user.id) return apt;

  // Check health worker assignment
  if (user.role === 'HEALTH_WORKER') {
    const hwAssigned = await q(
      `SELECT 1 FROM health_worker_patients hwp
       JOIN health_workers hw ON hw.id = hwp.health_worker_id
       WHERE hw.user_id = ? AND hwp.patient_id = ?`,
      [user.id, apt.patient_id]
    );
    if (hwAssigned.length > 0) return apt;
  }

  return null;
};

// Async route wrapper with error handling
const wrap = (fn) => (req, res, next) => {
  fn(req, res, next).catch((err) => {
    console.error('API Error:', err.message);
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Record already exists or time slot is already booked.' });
    }
    return res.status(500).json({ error: err.message || 'Internal server error' });
  });
};

// Auth middleware with role verification
const auth = (...roles) => (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mediconnect_ai_jwt_secret_key_2026_secure');
    req.user = decoded;
    if (roles.length > 0 && !roles.includes(decoded.role)) {
      return res.status(403).json({ error: 'Access forbidden: Insufficient permissions' });
    }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired authentication token' });
  }
};

const signToken = (u) =>
  jwt.sign(
    { id: u.id, role: u.role, name: u.name, email: u.email },
    process.env.JWT_SECRET || 'mediconnect_ai_jwt_secret_key_2026_secure',
    { expiresIn: '12h' }
  );

// ==========================================
// 1. AUTHENTICATION & PROFILE APIS
// ==========================================

// Register a new user (Supports PATIENT, DOCTOR, HEALTH_WORKER)
app.post('/api/auth/register', wrap(async (req, res) => {
  const {
    name,
    email,
    password,
    phone,
    gender,
    dob,
    address,
    language,
    role = 'PATIENT',
    // Patient specific
    emergency_contact_name,
    emergency_contact_phone,
    // Doctor specific
    specialization,
    qualification,
    experience,
    start_time,
    end_time,
    slot_duration_mins,
    available_days,
    consultation_fee,
    bio,
    // Health Worker specific
    assigned_area,
    employee_id
  } = req.body;

  const validRoles = ['PATIENT', 'DOCTOR', 'HEALTH_WORKER'];
  const userRole = validRoles.includes(role) ? role : 'PATIENT';

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Full name is required.' });
  }
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: 'A valid email address is required.' });
  }
  if (!password || password.length < 8 || !/\d/.test(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long and contain at least one number.' });
  }

  // Role-specific validations
  if (userRole === 'DOCTOR') {
    if (!specialization || !specialization.trim()) {
      return res.status(400).json({ error: 'Doctor specialization is required.' });
    }
    if (!qualification || !qualification.trim()) {
      return res.status(400).json({ error: 'Medical qualification (e.g. MBBS, MD) is required.' });
    }
  }

  if (userRole === 'HEALTH_WORKER') {
    if (!assigned_area || !assigned_area.trim()) {
      return res.status(400).json({ error: 'Assigned community area/zone is required.' });
    }
  }

  const existing = await q('SELECT id FROM users WHERE email = ?', [email.toLowerCase().trim()]);
  if (existing.length > 0) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await q(
    'INSERT INTO users (name, email, password_hash, phone, gender, dob, address, language, emergency_contact_name, emergency_contact_phone, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      name.trim(),
      email.toLowerCase().trim(),
      passwordHash,
      phone || null,
      gender || 'Other',
      dob || null,
      address || null,
      language || 'English',
      emergency_contact_name || null,
      emergency_contact_phone || null,
      userRole
    ]
  );
  const userId = result.insertId;

  // Insert role profile
  if (userRole === 'DOCTOR') {
    await q(
      `INSERT INTO doctors (user_id, specialization, experience, qualification, start_time, end_time, slot_duration_mins, available_days, consultation_fee, bio)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        specialization.trim(),
        parseInt(experience, 10) || 0,
        qualification.trim(),
        start_time ? (start_time.length === 5 ? `${start_time}:00` : start_time) : '09:00:00',
        end_time ? (end_time.length === 5 ? `${end_time}:00` : end_time) : '17:00:00',
        parseInt(slot_duration_mins, 10) || 30,
        available_days || 'Mon,Tue,Wed,Thu,Fri,Sat',
        parseInt(consultation_fee, 10) || 500,
        bio || null
      ]
    );
  } else if (userRole === 'HEALTH_WORKER') {
    const empId = employee_id || `HW-${Math.floor(100 + Math.random() * 900)}`;
    await q(
      `INSERT INTO health_workers (user_id, assigned_area, employee_id, qualification)
       VALUES (?, ?, ?, ?)`,
      [
        userId,
        assigned_area.trim(),
        empId,
        qualification || 'Certified Community Health Worker (ANM/ASHA)'
      ]
    );
  }

  const newUser = { id: userId, name: name.trim(), email: email.toLowerCase().trim(), role: userRole, language: language || 'English' };
  const token = signToken(newUser);
  res.status(201).json({ token, user: newUser, message: `${userRole.replace('_', ' ')} registration successful!` });
}));

// User Login (supports PATIENT, DOCTOR, HEALTH_WORKER, ADMIN with optional role verification)
app.post('/api/auth/login', wrap(async (req, res) => {
  const { email, password, expected_role } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const users = await q('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
  if (users.length === 0) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const user = users[0];
  const isMatch = await bcrypt.compare(password, user.password_hash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  // Verify role if an expected role was chosen from a role-specific portal
  if (expected_role && expected_role !== 'ANY' && user.role !== expected_role) {
    return res.status(403).json({
      error: `This account is registered as a ${user.role.replace('_', ' ')}. Please sign in using the ${user.role.replace('_', ' ')} portal.`
    });
  }

  const tokenUser = { id: user.id, name: user.name, email: user.email, role: user.role, language: user.language };
  const token = signToken(tokenUser);

  res.json({
    token,
    user: tokenUser,
    message: `Welcome back, ${user.name}!`
  });
}));

// Current User Details
app.get('/api/auth/me', auth(), wrap(async (req, res) => {
  const users = await q(
    'SELECT id, name, email, phone, gender, dob, address, language, emergency_contact_name, emergency_contact_phone, medical_history, allergies, current_medications, profile_photo, role, created_at FROM users WHERE id = ?',
    [req.user.id]
  );
  if (users.length === 0) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const profile = { ...users[0] };

  if (profile.role === 'DOCTOR') {
    const docData = await q('SELECT * FROM doctors WHERE user_id = ?', [profile.id]);
    if (docData.length > 0) profile.doctorInfo = docData[0];
  } else if (profile.role === 'HEALTH_WORKER') {
    const hwData = await q('SELECT * FROM health_workers WHERE user_id = ?', [profile.id]);
    if (hwData.length > 0) profile.healthWorkerInfo = hwData[0];
  }

  res.json(profile);
}));

// Update Profile
app.put('/api/auth/profile', auth(), wrap(async (req, res) => {
  const { phone, address, language, emergency_contact_name, emergency_contact_phone, name, medical_history, allergies, current_medications, profile_photo } = req.body;

  await q(
    `UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone), address = COALESCE(?, address),
     language = COALESCE(?, language), emergency_contact_name = COALESCE(?, emergency_contact_name),
     emergency_contact_phone = COALESCE(?, emergency_contact_phone), medical_history = COALESCE(?, medical_history),
     allergies = COALESCE(?, allergies), current_medications = COALESCE(?, current_medications),
     profile_photo = COALESCE(?, profile_photo) WHERE id = ?`,
    [name || null, phone || null, address || null, language || null, emergency_contact_name || null, emergency_contact_phone || null, medical_history || null, allergies || null, current_medications || null, profile_photo || null, req.user.id]
  );

  // If Doctor updating professional info
  if (req.user.role === 'DOCTOR' && req.body.doctorInfo) {
    const { specialization, experience, qualification, bio, consultation_fee } = req.body.doctorInfo;
    await q(
      'UPDATE doctors SET specialization = COALESCE(?, specialization), experience = COALESCE(?, experience), qualification = COALESCE(?, qualification), bio = COALESCE(?, bio), consultation_fee = COALESCE(?, consultation_fee) WHERE user_id = ?',
      [specialization, experience, qualification, bio, consultation_fee, req.user.id]
    );
  }

  // If Health Worker updating area & health centre info
  if (req.user.role === 'HEALTH_WORKER' && req.body.healthWorkerInfo) {
    const { assigned_area, qualification, health_centre, location } = req.body.healthWorkerInfo;
    await q(
      `UPDATE health_workers SET assigned_area = COALESCE(?, assigned_area), qualification = COALESCE(?, qualification),
       health_centre = COALESCE(?, health_centre), location = COALESCE(?, location) WHERE user_id = ?`,
      [assigned_area || null, qualification || null, health_centre || null, location || null, req.user.id]
    );
  }

  res.json({ ok: true, message: 'Profile updated successfully!' });
}));

// Change Password
app.put('/api/auth/change-password', auth(), wrap(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Both current password and new password are required.' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
  }

  const [user] = await q('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
  if (!user) return res.status(404).json({ error: 'User not found.' });

  const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }

  const newHash = await bcrypt.hash(newPassword, 10);
  await q('UPDATE users SET password_hash = ? WHERE id = ?', [newHash, req.user.id]);
  res.json({ ok: true, message: 'Password updated successfully!' });
}));

// ==========================================
// 2. DOCTOR DIRECTORY & AVAILABILITY APIS
// ==========================================

// Get list of doctors with filters
app.get('/api/doctors', auth(), wrap(async (req, res) => {
  const search = req.query.search ? `%${req.query.search.trim()}%` : '%';
  const spec = req.query.spec ? req.query.spec.trim() : '';

  let sql = `
    SELECT d.id, d.user_id, u.name, u.email, u.phone, d.specialization, d.experience, d.qualification,
           d.start_time, d.end_time, d.slot_duration_mins, d.available_days, d.consultation_fee, d.bio
    FROM doctors d
    JOIN users u ON u.id = d.user_id
    WHERE (u.name LIKE ? OR d.specialization LIKE ?)
  `;
  const params = [search, search];

  if (spec) {
    sql += ' AND d.specialization = ?';
    params.push(spec);
  }
  sql += ' ORDER BY d.experience DESC';

  const doctors = await q(sql, params);
  res.json(doctors);
}));

// Get specific doctor details & booked slots for a given date
app.get('/api/doctors/:id', auth(), wrap(async (req, res) => {
  const doctors = await q(
    `SELECT d.*, u.name, u.email, u.phone
     FROM doctors d
     JOIN users u ON u.id = d.user_id
     WHERE d.id = ?`,
    [req.params.id]
  );
  if (doctors.length === 0) {
    return res.status(404).json({ error: 'Doctor not found.' });
  }

  const doctor = doctors[0];
  const date = req.query.date;
  let bookedSlots = [];

  if (date) {
    const slots = await q(
      `SELECT time, status FROM appointments WHERE doctor_id = ? AND date = ? AND status NOT IN ('Cancelled', 'Rejected')`,
      [doctor.id, date]
    );
    bookedSlots = slots.map(s => s.time.slice(0, 5));
  }

  res.json({ doctor, bookedSlots });
}));

// Doctor updates their availability (hours, days, slot duration)
app.put('/api/doctor/availability', auth('DOCTOR'), wrap(async (req, res) => {
  const { start_time, end_time, slot_duration_mins, available_days } = req.body;

  if (!start_time || !end_time) {
    return res.status(400).json({ error: 'Start time and end time are required.' });
  }

  await q(
    `UPDATE doctors
     SET start_time = ?, end_time = ?, slot_duration_mins = ?, available_days = ?
     WHERE user_id = ?`,
    [start_time, end_time, slot_duration_mins || 30, available_days || 'Mon,Tue,Wed,Thu,Fri,Sat', req.user.id]
  );

  res.json({ ok: true, message: 'Availability schedule saved successfully!' });
}));

// Doctor Dashboard Stats
app.get('/api/doctor/dashboard', auth('DOCTOR'), wrap(async (req, res) => {
  const docRows = await q('SELECT id FROM doctors WHERE user_id = ?', [req.user.id]);
  if (docRows.length === 0) return res.status(404).json({ error: 'Doctor record not found.' });
  const doctorId = docRows[0].id;

  const today = new Date().toISOString().split('T')[0];

  const [todayApts] = await q('SELECT COUNT(*) c FROM appointments WHERE doctor_id = ? AND date = ?', [doctorId, today]);
  const [pendingApts] = await q('SELECT COUNT(*) c FROM appointments WHERE doctor_id = ? AND status = "Pending"', [doctorId]);
  const [totalPatients] = await q('SELECT COUNT(DISTINCT patient_id) c FROM appointments WHERE doctor_id = ?', [doctorId]);
  const [totalPrescriptions] = await q('SELECT COUNT(*) c FROM prescriptions WHERE doctor_id = ?', [doctorId]);

  const upcoming = await q(
    `SELECT a.*, u.name patient_name, u.phone patient_phone, u.gender patient_gender, u.dob patient_dob
     FROM appointments a
     JOIN users u ON u.id = a.patient_id
     WHERE a.doctor_id = ? AND a.date >= ? AND a.status IN ('Pending', 'Confirmed')
     ORDER BY a.date ASC, a.time ASC
     LIMIT 5`,
    [doctorId, today]
  );

  res.json({
    stats: {
      todayAppointments: todayApts.c,
      pendingRequests: pendingApts.c,
      totalPatients: totalPatients.c,
      totalPrescriptions: totalPrescriptions.c
    },
    upcoming
  });
}));

// Doctor's unique patients
app.get('/api/doctor/patients', auth('DOCTOR'), wrap(async (req, res) => {
  const docRows = await q('SELECT id FROM doctors WHERE user_id = ?', [req.user.id]);
  if (docRows.length === 0) return res.status(404).json({ error: 'Doctor not found.' });
  const doctorId = docRows[0].id;

  const patients = await q(
    `SELECT DISTINCT u.id, u.name, u.email, u.phone, u.gender, u.dob, u.address, u.language,
            MAX(a.date) last_consultation_date,
            COUNT(DISTINCT a.id) total_appointments,
            COUNT(DISTINCT p.id) total_prescriptions
     FROM users u
     JOIN appointments a ON a.patient_id = u.id AND a.doctor_id = ?
     LEFT JOIN prescriptions p ON p.patient_id = u.id AND p.doctor_id = ?
     GROUP BY u.id
     ORDER BY last_consultation_date DESC`,
    [doctorId, doctorId]
  );

  res.json(patients);
}));

// Doctor view detailed patient medical records (strictly authorized)
app.get('/api/doctor/patients/:patientId', auth('DOCTOR'), wrap(async (req, res) => {
  const docRows = await q('SELECT id FROM doctors WHERE user_id = ?', [req.user.id]);
  if (docRows.length === 0) return res.status(404).json({ error: 'Doctor not found.' });
  const doctorId = docRows[0].id;
  const patientId = req.params.patientId;

  // Verify doctor has at least one appointment with this patient
  const hasAccess = await q('SELECT 1 FROM appointments WHERE doctor_id = ? AND patient_id = ? LIMIT 1', [doctorId, patientId]);
  if (hasAccess.length === 0) {
    return res.status(403).json({ error: 'Access denied: You are not assigned to this patient.' });
  }

  const patient = (await q('SELECT id, name, email, phone, gender, dob, address, language, emergency_contact_name, emergency_contact_phone FROM users WHERE id = ?', [patientId]))[0];
  const appointments = await q('SELECT * FROM appointments WHERE patient_id = ? AND doctor_id = ? ORDER BY date DESC, time DESC', [patientId, doctorId]);
  const prescriptions = await q(
    `SELECT p.*,
            (SELECT JSON_ARRAYAGG(JSON_OBJECT('id', pi.id, 'medicine', m.name, 'dosage', pi.dosage, 'frequency', pi.frequency, 'days', pi.days, 'instructions', pi.instructions))
             FROM prescription_items pi
             JOIN medicines m ON m.id = pi.medicine_id
             WHERE pi.prescription_id = p.id) items
     FROM prescriptions p
     WHERE p.patient_id = ? AND p.doctor_id = ?
     ORDER BY p.created_at DESC`,
    [patientId, doctorId]
  );

  res.json({ patient, appointments, prescriptions });
}));

// ==========================================
// 3. APPOINTMENTS MANAGEMENT APIS
// ==========================================

// Doctor available slots for a given date
app.get('/api/doctors/:id/available-slots', auth(), wrap(async (req, res) => {
  const doctorId = req.params.id;
  const date = req.query.date;
  if (!date) {
    return res.status(400).json({ error: 'Date query parameter is required (YYYY-MM-DD).' });
  }

  const docRows = await q('SELECT d.*, u.name doctor_name FROM doctors d JOIN users u ON u.id = d.user_id WHERE d.id = ?', [doctorId]);
  if (docRows.length === 0) return res.status(404).json({ error: 'Doctor not found.' });
  const doctor = docRows[0];

  const bookedRows = await q(
    `SELECT time FROM appointments WHERE doctor_id = ? AND date = ? AND status NOT IN ('Cancelled', 'Rejected')`,
    [doctorId, date]
  );
  const bookedSlots = bookedRows.map((r) => r.time.slice(0, 5));

  const startParts = (doctor.start_time || '09:00:00').split(':').map(Number);
  const endParts = (doctor.end_time || '17:00:00').split(':').map(Number);
  const slotDuration = doctor.slot_duration_mins || 30;

  const startMins = startParts[0] * 60 + startParts[1];
  const endMins = endParts[0] * 60 + endParts[1];
  const slots = [];

  for (let m = startMins; m + slotDuration <= endMins; m += slotDuration) {
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    const timeStr = `${hh}:${mm}`;
    slots.push({
      time: timeStr,
      available: !bookedSlots.includes(timeStr)
    });
  }

  res.json({
    doctor: {
      id: doctor.id,
      name: doctor.doctor_name,
      specialization: doctor.specialization,
      start_time: doctor.start_time,
      end_time: doctor.end_time,
      slot_duration_mins: doctor.slot_duration_mins,
      available_days: doctor.available_days
    },
    date,
    slots,
    bookedSlots
  });
}));

// Create Appointment (PATIENT or HEALTH_WORKER on behalf of patient)
app.post('/api/appointments', auth('PATIENT', 'HEALTH_WORKER'), wrap(async (req, res) => {
  let { doctor_id, date, time, reason, patient_id, consultation_type } = req.body;

  // If patient, enforce self
  if (req.user.role === 'PATIENT') {
    patient_id = req.user.id;
  } else if (req.user.role === 'HEALTH_WORKER') {
    if (!patient_id) {
      return res.status(400).json({ error: 'Please specify the patient for this booking.' });
    }
  }

  if (!doctor_id || !date || !time) {
    return res.status(400).json({ error: 'Doctor, appointment date, and time slot are required.' });
  }

  // Validate date is not in past
  const appointmentDateTime = new Date(`${date}T${time}`);
  if (isNaN(appointmentDateTime.getTime()) || appointmentDateTime <= new Date()) {
    return res.status(400).json({ error: 'Please choose a valid future date and time.' });
  }

  // Validate doctor availability hours
  const docRows = await q('SELECT * FROM doctors WHERE id = ?', [doctor_id]);
  if (docRows.length === 0) {
    return res.status(404).json({ error: 'Selected doctor does not exist.' });
  }
  const doctor = docRows[0];
  const timeFormatted = time.length === 5 ? `${time}:00` : time;

  if (timeFormatted < doctor.start_time || timeFormatted >= doctor.end_time) {
    return res.status(400).json({
      error: `Doctor is only available between ${doctor.start_time.slice(0, 5)} and ${doctor.end_time.slice(0, 5)}.`
    });
  }

  // Check if slot already booked
  const existingSlot = await q(
    `SELECT id FROM appointments WHERE doctor_id = ? AND date = ? AND time = ? AND status NOT IN ('Cancelled', 'Rejected')`,
    [doctor_id, date, timeFormatted]
  );
  if (existingSlot.length > 0) {
    return res.status(409).json({ error: 'This time slot is already booked. Please select another time.' });
  }

  let hwId = null;
  if (req.user.role === 'HEALTH_WORKER') {
    const hwRecord = await q('SELECT id FROM health_workers WHERE user_id = ?', [req.user.id]);
    if (hwRecord.length > 0) hwId = hwRecord[0].id;
  }

  const validConsultType = ['Video', 'Audio', 'In-Person'].includes(consultation_type) ? consultation_type : 'Video';

  const result = await q(
    'INSERT INTO appointments (patient_id, doctor_id, date, time, reason, consultation_type, status, meeting_status, booked_by_health_worker_id) VALUES (?, ?, ?, ?, ?, ?, "Pending", "Scheduled", ?)',
    [patient_id, doctor_id, date, timeFormatted, reason || 'General Consultation', validConsultType, hwId]
  );

  // Send notifications
  await q('INSERT INTO notifications (user_id, message) VALUES (?, ?)',
    [patient_id, `Appointment booked with doctor for ${date} at ${timeFormatted.slice(0, 5)} (${validConsultType}).`]);
  await q('INSERT INTO notifications (user_id, message) VALUES (?, ?)',
    [doctor.user_id, `New appointment request received for ${date} at ${timeFormatted.slice(0, 5)}.`]);

  res.status(201).json({
    id: result.insertId,
    consultation_type: validConsultType,
    meeting_status: 'Scheduled',
    message: 'Appointment booked successfully! Awaiting doctor confirmation.'
  });
}));

// Get Appointments (Role-filtered)
app.get('/api/appointments', auth(), wrap(async (req, res) => {
  const { id: userId, role } = req.user;

  let sql = `
    SELECT a.*,
           pu.name AS patient_name, pu.email AS patient_email, pu.phone AS patient_phone,
           du.name AS doctor_name, d.specialization, d.consultation_fee,
           hw.employee_id AS health_worker_emp_id
    FROM appointments a
    JOIN users pu ON pu.id = a.patient_id
    JOIN doctors d ON d.id = a.doctor_id
    JOIN users du ON du.id = d.user_id
    LEFT JOIN health_workers hw ON hw.id = a.booked_by_health_worker_id
  `;
  const params = [];

  if (role === 'PATIENT') {
    sql += ' WHERE a.patient_id = ? ORDER BY a.date DESC, a.time DESC';
    params.push(userId);
  } else if (role === 'DOCTOR') {
    sql += ' WHERE d.user_id = ? ORDER BY a.date DESC, a.time DESC';
    params.push(userId);
  } else if (role === 'HEALTH_WORKER') {
    const hwRows = await q('SELECT id FROM health_workers WHERE user_id = ?', [userId]);
    const hwId = hwRows.length > 0 ? hwRows[0].id : 0;
    sql += `
      WHERE (
        a.booked_by_health_worker_id = ?
        OR a.patient_id IN (SELECT patient_id FROM health_worker_patients WHERE health_worker_id = ?)
      )
      ORDER BY a.date DESC, a.time DESC
    `;
    params.push(hwId, hwId);
  } else {
    // Admin
    sql += ' ORDER BY a.date DESC, a.time DESC';
  }

  const appointments = await q(sql, params);
  res.json(appointments);
}));

// Update Appointment Status (Accept, Reject, Complete, Cancel)
app.put('/api/appointments/:id/status', auth('DOCTOR', 'ADMIN', 'HEALTH_WORKER'), wrap(async (req, res) => {
  const { status } = req.body;
  const allowed = ['Confirmed', 'Rejected', 'Completed', 'Cancelled'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'Invalid status update requested.' });
  }

  const aptRows = await q('SELECT a.*, d.user_id doctor_user_id FROM appointments a JOIN doctors d ON d.id = a.doctor_id WHERE a.id = ?', [req.params.id]);
  if (aptRows.length === 0) {
    return res.status(404).json({ error: 'Appointment not found.' });
  }
  const apt = aptRows[0];

  // Authorization check for doctors
  if (req.user.role === 'DOCTOR' && apt.doctor_user_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden: You cannot modify appointments for other doctors.' });
  }

  let meetingStatusUpdate = '';
  if (status === 'Completed') {
    meetingStatusUpdate = ', meeting_status = "Completed", consultation_end_time = COALESCE(consultation_end_time, NOW())';
  } else if (status === 'Cancelled') {
    meetingStatusUpdate = ', meeting_status = "Cancelled"';
  }

  await q(`UPDATE appointments SET status = ? ${meetingStatusUpdate} WHERE id = ?`, [status, req.params.id]);

  // Send status update notification to patient
  await q('INSERT INTO notifications (user_id, message) VALUES (?, ?)',
    [apt.patient_id, `Your appointment scheduled for ${apt.date} at ${apt.time.slice(0, 5)} was updated to: ${status}.`]);

  res.json({ ok: true, message: `Appointment status updated to ${status}.` });
}));

// Reschedule Appointment
app.put('/api/appointments/:id/reschedule', auth('PATIENT', 'DOCTOR', 'HEALTH_WORKER', 'ADMIN'), wrap(async (req, res) => {
  const { date, time } = req.body;
  if (!date || !time) {
    return res.status(400).json({ error: 'New appointment date and time are required.' });
  }

  const aptRows = await q('SELECT * FROM appointments WHERE id = ?', [req.params.id]);
  if (aptRows.length === 0) return res.status(404).json({ error: 'Appointment not found.' });
  const apt = aptRows[0];

  const timeFormatted = time.length === 5 ? `${time}:00` : time;
  // Check double-booking
  const conflict = await q(
    `SELECT id FROM appointments WHERE doctor_id = ? AND date = ? AND time = ? AND id != ? AND status NOT IN ('Cancelled', 'Rejected')`,
    [apt.doctor_id, date, timeFormatted, apt.id]
  );
  if (conflict.length > 0) {
    return res.status(409).json({ error: 'Selected time slot is already booked. Please choose another.' });
  }

  await q('UPDATE appointments SET date = ?, time = ?, status = "Confirmed", meeting_status = "Scheduled" WHERE id = ?', [date, timeFormatted, apt.id]);

  await q('INSERT INTO notifications (user_id, message) VALUES (?, ?)',
    [apt.patient_id, `Your appointment has been rescheduled to ${date} at ${timeFormatted.slice(0, 5)}.`]);

  res.json({ ok: true, message: 'Appointment rescheduled successfully!' });
}));

// Patient / Health worker cancels appointment
app.delete('/api/appointments/:id', auth('PATIENT', 'HEALTH_WORKER', 'ADMIN'), wrap(async (req, res) => {
  const aptRows = await q('SELECT * FROM appointments WHERE id = ?', [req.params.id]);
  if (aptRows.length === 0) return res.status(404).json({ error: 'Appointment not found.' });
  const apt = aptRows[0];

  if (req.user.role === 'PATIENT' && apt.patient_id !== req.user.id) {
    return res.status(403).json({ error: 'Forbidden: You can only cancel your own appointments.' });
  }

  await q('UPDATE appointments SET status = "Cancelled", meeting_status = "Cancelled" WHERE id = ?', [req.params.id]);
  res.json({ ok: true, message: 'Appointment cancelled successfully.' });
}));

// Update Meeting Status (e.g. Scheduled, Waiting for Doctor, Waiting for Patient, In Progress, Completed, Finished, Cancelled)
app.put('/api/appointments/:id/meeting', auth('PATIENT', 'DOCTOR', 'HEALTH_WORKER', 'ADMIN'), wrap(async (req, res) => {
  const { meeting_status } = req.body;
  const allowed = ['Scheduled', 'Waiting for Doctor', 'Waiting for Patient', 'In Progress', 'Completed', 'Finished', 'Cancelled'];
  if (!allowed.includes(meeting_status)) {
    return res.status(400).json({ error: 'Invalid meeting status.' });
  }

  const apt = await checkConsultationAccess(req.user, req.params.id);
  if (!apt) return res.status(403).json({ error: 'Access denied.' });

  if (meeting_status === 'In Progress') {
    await q('UPDATE appointments SET meeting_status = ?, consultation_start_time = COALESCE(consultation_start_time, NOW()) WHERE id = ?', [meeting_status, req.params.id]);
  } else if (meeting_status === 'Completed' || meeting_status === 'Finished') {
    await q('UPDATE appointments SET meeting_status = "Completed", consultation_end_time = NOW() WHERE id = ?', [req.params.id]);
  } else {
    await q('UPDATE appointments SET meeting_status = ? WHERE id = ?', [meeting_status, req.params.id]);
  }

  res.json({ ok: true, meeting_status });
}));

// ==========================================
// 4. TELECONSULTATION & IN-CALL MESSAGES
// ==========================================
// Note: checkConsultationAccess defined above for WebSocket & REST authorization

// Get consultation room details
app.get('/api/consultations/:id/session', auth(), wrap(async (req, res) => {
  const apt = await checkConsultationAccess(req.user, req.params.id);
  if (!apt) return res.status(403).json({ error: 'You do not have access to this consultation room.' });

  const details = await q(
    `SELECT a.*, pu.name patient_name, du.name doctor_name, d.specialization
     FROM appointments a
     JOIN users pu ON pu.id = a.patient_id
     JOIN doctors d ON d.id = a.doctor_id
     JOIN users du ON du.id = d.user_id
     WHERE a.id = ?`,
    [req.params.id]
  );

  res.json(details[0]);
}));

// Network configuration endpoint to help QR code point to host's LAN IP for mobile scanning
app.get('/api/config/network-info', (req, res) => {
  const nets = os.networkInterfaces();
  let hostIp = 'localhost';

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal && !name.includes('Virtual') && !name.includes('WSL') && !name.includes('vEthernet') && !net.address.startsWith('192.168.137.')) {
        hostIp = net.address;
        break;
      }
    }
    if (hostIp !== 'localhost') break;
  }
  if (hostIp === 'localhost') {
    for (const name of Object.keys(nets)) {
      for (const net of nets[name]) {
        if (net.family === 'IPv4' && !net.internal) {
          hostIp = net.address;
          break;
        }
      }
      if (hostIp !== 'localhost') break;
    }
  }

  res.json({
    hostIp,
    clientPort: 5173,
    serverPort: 5000,
    paymentFee: 500
  });
});

// Google Pay / UPI Payee Configuration
let inMemoryUpiId = process.env.UPI_PAYEE_ID || '';
let inMemoryUpiName = process.env.UPI_PAYEE_NAME || 'MediConnect AI';

// Get current UPI payment config
app.get('/api/config/upi', (req, res) => {
  const currentId = inMemoryUpiId || process.env.UPI_PAYEE_ID || '';
  const currentName = inMemoryUpiName || process.env.UPI_PAYEE_NAME || 'MediConnect AI';
  res.json({
    upiPayeeId: currentId,
    upiPayeeName: currentName,
    amount: '500.00',
    currency: 'INR',
    transactionNote: 'MediConnect AI Consultation Fee',
    isConfigured: !!(currentId && currentId.trim().length > 0)
  });
});

// Update UPI payment config
app.post('/api/config/upi', auth(), wrap(async (req, res) => {
  const { upiPayeeId, upiPayeeName } = req.body;
  if (!upiPayeeId || !upiPayeeId.includes('@')) {
    return res.status(400).json({ error: 'Please enter a valid UPI ID (e.g. yourname@okhdfcbank or clinic@okaxis).' });
  }
  inMemoryUpiId = upiPayeeId.trim();
  if (upiPayeeName && upiPayeeName.trim()) {
    inMemoryUpiName = upiPayeeName.trim();
  }
  res.json({
    ok: true,
    message: 'UPI payment configuration updated successfully.',
    upiPayeeId: inMemoryUpiId,
    upiPayeeName: inMemoryUpiName,
    isConfigured: true
  });
}));

// Public consultation payment details endpoint (for QR scan on mobile or desktop)
app.get('/api/consultations/:id/payment-info', wrap(async (req, res) => {
  const aptId = req.params.id;
  if (!aptId || aptId === 'null' || aptId === 'undefined' || aptId === '0') {
    return res.json({
      appointmentId: null,
      patientName: 'General Consultation Patient',
      doctorName: 'Dr. MediConnect Specialist',
      specialization: 'General Medicine & Telehealth',
      hospitalName: 'MediConnect AI Healthcare Network',
      date: new Date().toISOString().slice(0, 10),
      time: 'Live Teleconsultation',
      consultationType: 'Video',
      fee: 500,
      paymentStatus: 'Pending',
      isDemo: true,
      currency: 'INR',
      amountDisplay: '₹500',
      message: 'MediConnect AI Academic Healthcare Demo - Real payment gateway not configured.'
    });
  }

  const rows = await q(
    `SELECT a.id, a.date, a.time, a.status, a.consultation_type,
            pu.name AS patient_name,
            du.name AS doctor_name,
            d.specialization
     FROM appointments a
     LEFT JOIN users pu ON pu.id = a.patient_id
     LEFT JOIN doctors d ON d.id = a.doctor_id
     LEFT JOIN users du ON du.id = d.user_id
     WHERE a.id = ?`,
    [aptId]
  );

  if (rows.length === 0) {
    return res.json({
      appointmentId: aptId,
      patientName: 'Teleconsultation Patient',
      doctorName: 'Dr. MediConnect Specialist',
      specialization: 'General Medicine & Telehealth',
      hospitalName: 'MediConnect AI Healthcare Network',
      date: new Date().toISOString().slice(0, 10),
      time: 'Scheduled Session',
      consultationType: 'Video',
      fee: 500,
      paymentStatus: 'Pending',
      isDemo: true,
      currency: 'INR',
      amountDisplay: '₹500',
      message: 'MediConnect AI Academic Healthcare Demo - Real payment gateway not configured.'
    });
  }

  const apt = rows[0];
  res.json({
    appointmentId: apt.id,
    patientName: apt.patient_name || 'Patient',
    doctorName: apt.doctor_name || 'Doctor',
    specialization: apt.specialization || 'Clinical Specialist',
    hospitalName: 'MediConnect AI Healthcare Network',
    date: apt.date ? new Date(apt.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    time: apt.time ? apt.time.slice(0, 5) : 'Scheduled Slot',
    consultationType: apt.consultation_type || 'Video',
    fee: 500,
    paymentStatus: 'Pending',
    isDemo: true,
    currency: 'INR',
    amountDisplay: '₹500',
    message: 'MediConnect AI Academic Healthcare Demo - Real payment gateway not configured.'
  });
}));

// Get in-consultation chat messages
app.get('/api/consultations/:id/messages', auth(), wrap(async (req, res) => {
  const apt = await checkConsultationAccess(req.user, req.params.id);
  if (!apt) return res.status(403).json({ error: 'Access denied.' });

  const messages = await q(
    `SELECT m.*, u.name sender_name, u.role sender_role
     FROM consultation_messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.appointment_id = ?
     ORDER BY m.id ASC`,
    [req.params.id]
  );

  res.json(messages);
}));

// Send in-consultation chat message
app.post('/api/consultations/:id/messages', auth(), wrap(async (req, res) => {
  const apt = await checkConsultationAccess(req.user, req.params.id);
  if (!apt) return res.status(403).json({ error: 'Access denied.' });

  const { text, language } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Message cannot be empty.' });
  }

  const result = await q(
    'INSERT INTO consultation_messages (appointment_id, sender_id, text, language) VALUES (?, ?, ?, ?)',
    [req.params.id, req.user.id, text.trim(), language || 'English']
  );

  res.status(201).json({ id: result.insertId, ok: true });
}));

// ==========================================
// 5. AI HEALTH SUPPORT APIS - Intelligent Healthcare Assistant
// ==========================================

// --- Emergency detection patterns ---
const EMERGENCY_PATTERNS = [
  { patterns: ['chest pain', 'pressure in chest', 'heart attack', 'left arm pain', 'crushing chest', 'நெஞ்சு வலி', 'மாரடைப்பு'], specialty: 'Cardiologist', level: 'CRITICAL' },
  { patterns: ['difficulty breathing', 'shortness of breath', 'can\'t breathe', 'gasping', 'choking', 'severe breathing', 'மூச்சு திணறல்', 'சுவாசிப்பதில் சிரமம்'], specialty: 'Pulmonologist', level: 'CRITICAL' },
  { patterns: ['stroke', 'face drooping', 'arm weakness', 'speech difficulty', 'sudden numbness', 'sudden confusion', 'பக்கவாதம்'], specialty: 'Neurologist', level: 'CRITICAL' },
  { patterns: ['severe allergic', 'anaphylaxis', 'throat swelling', 'can\'t swallow', 'severe swelling'], specialty: 'General Medicine', level: 'CRITICAL' },
  { patterns: ['unconscious', 'unresponsive', 'not breathing', 'seizure', 'convulsion', 'fitting', 'மயக்கம்'], specialty: 'General Medicine', level: 'CRITICAL' },
  { patterns: ['heavy bleeding', 'won\'t stop bleeding', 'severe blood loss', 'ரத்தப்போக்கு'], specialty: 'General Medicine', level: 'CRITICAL' },
  { patterns: ['poisoning', 'overdose', 'swallowed chemicals', 'விஷம்'], specialty: 'General Medicine', level: 'CRITICAL' },
  { patterns: ['suicidal', 'want to die', 'end my life', 'self harm', 'killing myself', 'தற்கொலை'], specialty: 'Psychiatry', level: 'CRITICAL' }
];

// --- Symptom-to-specialty mapping ---
const SYMPTOM_SPECIALTY_MAP = [
  { patterns: ['fever', 'cold', 'cough', 'flu', 'viral', 'general weakness', 'fatigue', 'tiredness', 'body pain', 'weight loss', 'night sweats', 'காய்ச்சல்', 'இருமல்', 'சளி', 'உடல் சோர்வு', 'உடல் வலி'], specialty: 'General Medicine', reason: 'General symptoms that a physician can evaluate and diagnose' },
  { patterns: ['headache', 'migraine', 'dizziness', 'vertigo', 'numbness', 'tingling', 'memory loss', 'tremor', 'nerve pain', 'epilepsy', 'தலைவலி'], specialty: 'Neurology', reason: 'Neurological symptoms requiring specialist evaluation' },
  { patterns: ['chest pain', 'palpitation', 'heart', 'blood pressure', 'hypertension', 'bp', 'cardiac', 'cholesterol', 'இதயம்', 'இரத்த அழுத்தம்', 'பிபி'], specialty: 'Cardiology', reason: 'Cardiovascular symptoms requiring heart specialist evaluation' },
  { patterns: ['skin rash', 'acne', 'eczema', 'itching', 'skin irritation', 'psoriasis', 'dermatitis', 'fungal', 'hair loss', 'pigmentation', 'skin allergy', 'தோல்', 'சரும', 'அரிப்பு', 'பரு'], specialty: 'Dermatology', reason: 'Skin-related conditions requiring dermatological care' },
  { patterns: ['tooth', 'dental', 'gum', 'cavity', 'mouth ulcer', 'jaw pain', 'teeth', 'toothache', 'பல் வலி', 'பல்'], specialty: 'Dentistry', reason: 'Dental and oral health issues' },
  { patterns: ['eye', 'vision', 'blurry', 'eye pain', 'red eye', 'watery eye', 'spectacles', 'glasses', 'கண் வலி', 'கண்'], specialty: 'Ophthalmology', reason: 'Eye and vision-related conditions' },
  { patterns: ['ear pain', 'hearing', 'ear infection', 'sinus', 'nasal', 'nose bleed', 'tonsil', 'sore throat', 'throat infection', 'snoring', 'voice hoarse', 'காது வலி', 'தொண்டை வலி'], specialty: 'ENT', reason: 'Ear, nose, and throat conditions' },
  { patterns: ['stomach pain', 'abdomen', 'digestion', 'acid reflux', 'bloating', 'constipation', 'diarrhea', 'vomiting', 'nausea', 'gastric', 'liver', 'jaundice', 'ulcer', 'வயிற்று வலி', 'செரிமானம்', 'அசிடிட்டி'], specialty: 'Gastroenterology', reason: 'Digestive and gastrointestinal conditions' },
  { patterns: ['bone', 'joint pain', 'knee pain', 'back pain', 'spine', 'fracture', 'arthritis', 'shoulder pain', 'hip pain', 'muscle pain', 'sprain', 'ortho', 'மூட்டு வலி', 'முதுகு வலி', 'எலும்பு'], specialty: 'Orthopedics', reason: 'Bone, joint, and musculoskeletal conditions' },
  { patterns: ['anxiety', 'depression', 'stress', 'panic attack', 'insomnia', 'sleep problem', 'mood swing', 'mental health', 'emotional', 'sadness', 'worry', 'ocd', 'ptsd', 'மன அழுத்தம்', 'தூக்கமின்மை'], specialty: 'Psychiatry', reason: 'Mental and emotional health concerns requiring professional support' },
  { patterns: ['diabetes', 'thyroid', 'hormone', 'sugar level', 'blood sugar', 'pcos', 'endocrine', 'metabolism', 'சர்க்கரை நோய்'], specialty: 'Endocrinology', reason: 'Hormonal and metabolic conditions' },
  { patterns: ['kidney', 'urination', 'urine', 'bladder', 'kidney stone', 'uti', 'urinary', 'சிறுநீரக'], specialty: 'Urology', reason: 'Urinary tract and kidney-related conditions' },
  { patterns: ['pregnancy', 'menstrual', 'period', 'gynecology', 'pelvic pain', 'fertility', 'obstetric', 'மாதவிடாய்', 'கர்ப்பம்'], specialty: 'Gynecology', reason: 'Women\'s health and reproductive concerns' },
  { patterns: ['child', 'baby', 'infant', 'toddler', 'newborn', 'pediatric', 'vaccination child', 'குழந்தை'], specialty: 'Pediatrics', reason: 'Child and infant health care' },
  { patterns: ['cancer', 'tumor', 'lump', 'biopsy', 'chemotherapy', 'oncology', 'புற்றுநோய்'], specialty: 'Oncology', reason: 'Concerns requiring oncological evaluation' },
  { patterns: ['asthma', 'breathing', 'wheezing', 'lung', 'respiratory', 'bronchitis', 'pneumonia', 'tb', 'tuberculosis', 'ஆஸ்துமா'], specialty: 'Pulmonology', reason: 'Respiratory and lung conditions' },
  { patterns: ['allergy', 'allergic reaction', 'hay fever', 'food allergy', 'hives', 'immune', 'ஒவ்வாமை'], specialty: 'Allergy & Immunology', reason: 'Allergic and immune system conditions' }
];

// --- Comprehensive local knowledge base ---
const LOCAL_KNOWLEDGE_BASE = [
  {
    patterns: ['headache', 'head ache', 'head pain'],
    topics: ['headache cause', 'why headache'],
    response: {
      title: 'Understanding Headaches',
      answer: 'Headaches can occur due to various reasons including dehydration, stress, lack of sleep, eye strain, tension, sinus issues, or underlying medical conditions.',
      details: [
        '**Common Causes:** Dehydration, stress, poor sleep, eye strain, caffeine withdrawal, hunger, weather changes',
        '**Warning Signs:** Sudden severe "thunderclap" headache, headache with fever and stiff neck, headache after head injury, vision changes, confusion, weakness',
        '**Home Care:** Rest in a quiet dark room, stay hydrated (8+ glasses of water daily), apply a cool compress to the forehead, practice relaxation techniques'
      ],
      nextSteps: 'If headaches are frequent (>2 per week), severe, or accompanied by other symptoms like vision changes or weakness, consult a General Physician or Neurologist.',
      specialty: 'General Medicine'
    }
  },
  {
    patterns: ['fever', 'temperature', 'chills', 'pyrexia', 'mild fever'],
    topics: ['fever cause', 'why fever', 'fever treatment'],
    response: {
      title: 'Understanding Fever',
      answer: 'Fever is your body\'s natural response to fighting infections. A temperature above 98.6°F (37°C) is considered elevated, and above 100.4°F (38°C) is typically classified as fever.',
      details: [
        '**Common Causes:** Viral infections (flu, cold), bacterial infections, urinary tract infections, inflammatory conditions',
        '**Home Care:** Rest adequately, drink plenty of fluids (water, ORS, clear soups), wear light clothing, sponge with lukewarm water',
        '**When to Worry:** Temperature above 103°F (39.4°C), fever lasting more than 3 days, fever with rash or stiff neck, difficulty breathing alongside fever'
      ],
      nextSteps: 'See a General Physician if fever persists beyond 48-72 hours, exceeds 103°F, or is accompanied by severe symptoms.',
      specialty: 'General Medicine'
    }
  },
  {
    patterns: ['cough', 'cold', 'sore throat', 'runny nose', 'nasal congestion'],
    topics: ['cough treatment', 'cold remedy'],
    response: {
      title: 'Cough, Cold & Sore Throat',
      answer: 'Upper respiratory infections are commonly caused by viruses and typically resolve within 7-10 days. Most colds do not require antibiotics.',
      details: [
        '**Home Remedies:** Warm fluids (honey-lemon water, herbal tea), steam inhalation, saline gargles, adequate rest, keeping the room humidified',
        '**Warning Signs:** Cough lasting more than 2-3 weeks, coughing up blood, high fever with chills, difficulty breathing, severe throat pain preventing swallowing',
        '**Prevention:** Frequent handwashing, avoiding close contact with sick individuals, maintaining good hygiene'
      ],
      nextSteps: 'Consult a General Physician if symptoms worsen after a week, if you develop high fever, or if you experience difficulty breathing.',
      specialty: 'General Medicine'
    }
  },
  {
    patterns: ['stomach pain', 'abdomen pain', 'gastric', 'acidity', 'indigestion', 'bloating'],
    topics: ['stomach ache', 'digestion problem'],
    response: {
      title: 'Stomach Pain & Digestive Issues',
      answer: 'Stomach pain can range from mild indigestion to conditions requiring medical attention. The location, duration, and associated symptoms help determine the cause.',
      details: [
        '**Common Causes:** Indigestion, gas, acid reflux (GERD), food intolerance, gastritis, stress-related stomach issues',
        '**Home Care:** Eat smaller meals, avoid spicy and oily food, don\'t lie down immediately after eating, stay hydrated, try ginger or peppermint tea',
        '**Warning Signs:** Severe or persistent pain, blood in stool, unexplained weight loss, persistent vomiting, pain radiating to chest or back'
      ],
      nextSteps: 'See a Gastroenterologist if pain is severe, recurring, or accompanied by warning signs like blood in stool or unexplained weight loss.',
      specialty: 'Gastroenterology'
    }
  },
  {
    patterns: ['skin rash', 'rash', 'itching', 'skin problem', 'eczema', 'acne', 'pimple'],
    topics: ['skin issue', 'dermatology'],
    response: {
      title: 'Skin Problems & Rashes',
      answer: 'Skin conditions can result from allergies, infections, autoimmune disorders, or environmental factors. A proper dermatological evaluation helps determine the specific cause.',
      details: [
        '**Common Causes:** Allergic reactions, eczema, fungal infections, contact dermatitis, heat rash, insect bites, stress-related skin changes',
        '**Home Care:** Keep the area clean and dry, avoid scratching, use fragrance-free moisturizers, wear loose cotton clothing, avoid known allergens',
        '**Warning Signs:** Rapidly spreading rash with fever, blistering, signs of infection (warmth, pus, red streaks), rash that doesn\'t improve within a week'
      ],
      nextSteps: 'Consult a Dermatologist for persistent, worsening, or unexplained skin conditions.',
      specialty: 'Dermatology'
    }
  },
  {
    patterns: ['blood pressure', 'hypertension', 'bp high', 'high bp', 'bp low', 'hypotension'],
    topics: ['what is blood pressure', 'blood pressure meaning', 'high blood pressure'],
    response: {
      title: 'Understanding Blood Pressure',
      answer: 'Blood pressure measures the force of blood pushing against your artery walls. It\'s recorded as two numbers: systolic (pressure when heart beats) over diastolic (pressure between beats). Normal reading is around 120/80 mmHg.',
      details: [
        '**Categories:** Normal (<120/80), Elevated (120-129/<80), High Stage 1 (130-139/80-89), High Stage 2 (≥140/≥90), Crisis (>180/>120)',
        '**Risk Factors:** Family history, age, obesity, high sodium diet, physical inactivity, excessive alcohol, chronic stress, smoking',
        '**Lifestyle Management:** Regular exercise (30 mins/day), reduce salt intake, eat fruits and vegetables (DASH diet), maintain healthy weight, manage stress, limit alcohol',
        '**Why It Matters:** Uncontrolled high blood pressure increases risk of heart attack, stroke, kidney damage, and vision problems'
      ],
      nextSteps: 'Regular monitoring is essential. Consult a Cardiologist or General Physician if readings are consistently above 130/80 mmHg.',
      specialty: 'Cardiology'
    }
  },
  {
    patterns: ['diabetes', 'blood sugar', 'sugar level', 'glucose', 'diabetic'],
    topics: ['what is diabetes', 'diabetes management'],
    response: {
      title: 'Understanding Diabetes',
      answer: 'Diabetes is a chronic condition where the body either doesn\'t produce enough insulin or can\'t effectively use the insulin it produces, resulting in elevated blood sugar levels.',
      details: [
        '**Types:** Type 1 (autoimmune, insulin-dependent), Type 2 (most common, insulin resistance), Gestational (during pregnancy)',
        '**Symptoms:** Frequent urination, excessive thirst, unexplained weight loss, blurred vision, slow-healing wounds, fatigue',
        '**Management:** Regular blood sugar monitoring, balanced diet with controlled carbohydrates, regular physical activity, medication compliance, foot care',
        '**Monitoring:** Fasting blood sugar (70-100 mg/dL normal), HbA1c test every 3-6 months, regular kidney and eye check-ups'
      ],
      nextSteps: 'Consult an Endocrinologist or General Physician for proper diagnosis, medication management, and regular monitoring.',
      specialty: 'Endocrinology'
    }
  },
  {
    patterns: ['anxiety', 'depression', 'stress', 'panic', 'mental health', 'sad', 'worried', 'insomnia', 'sleep problem'],
    topics: ['mental health help', 'feeling anxious', 'feeling depressed'],
    response: {
      title: 'Mental & Emotional Health Support',
      answer: 'Mental health is as important as physical health. Feelings of anxiety, sadness, or stress are common, but when they persist and interfere with daily life, professional support can make a significant difference.',
      details: [
        '**Common Signs:** Persistent sadness or worry lasting more than 2 weeks, loss of interest in activities, sleep disturbances, changes in appetite, difficulty concentrating, feelings of worthlessness',
        '**Self-Care Strategies:** Regular physical exercise, maintaining social connections, practicing mindfulness or meditation, setting a consistent sleep schedule, limiting caffeine and alcohol',
        '**Professional Help:** Therapy (CBT, counseling), psychiatric evaluation if symptoms are severe, support groups',
        '**Important:** Seeking help is a sign of strength, not weakness. Mental health conditions are treatable.'
      ],
      nextSteps: 'Consult a Psychiatrist or qualified Mental Health Professional. If you\'re in crisis, reach out to a helpline immediately (India: iCall 9152987821, Vandrevala Foundation 1860-2662-345).',
      specialty: 'Psychiatry'
    }
  },
  {
    patterns: ['eye', 'vision', 'blurry vision', 'eye pain', 'red eye'],
    topics: ['eye problem', 'vision issue'],
    response: {
      title: 'Eye & Vision Concerns',
      answer: 'Eye symptoms can range from minor strain to conditions requiring urgent care. Sudden vision changes always warrant prompt medical attention.',
      details: [
        '**Common Causes:** Eye strain (screen time), dry eyes, refractive errors (needing glasses), conjunctivitis (pink eye), allergies',
        '**Home Care:** Follow the 20-20-20 rule (every 20 minutes, look 20 feet away for 20 seconds), use lubricating eye drops for dryness, wear sunglasses outdoors',
        '**Warning Signs:** Sudden vision loss, flashes of light, new floaters, severe eye pain with nausea, eye injury'
      ],
      nextSteps: 'Consult an Ophthalmologist for persistent symptoms or any sudden vision changes.',
      specialty: 'Ophthalmology'
    }
  },
  {
    patterns: ['dental', 'tooth', 'teeth', 'gum', 'toothache'],
    topics: ['dental pain', 'tooth problem'],
    response: {
      title: 'Dental & Oral Health',
      answer: 'Dental pain can indicate cavities, gum disease, tooth infection, or other oral health issues that require professional dental evaluation.',
      details: [
        '**Common Causes:** Cavities (dental caries), gum disease (gingivitis/periodontitis), tooth sensitivity, wisdom tooth issues, dental abscess',
        '**Home Care:** Rinse with warm salt water, maintain gentle brushing twice daily, floss daily, apply a cold compress for swelling',
        '**Warning Signs:** Severe throbbing pain, facial swelling, fever with dental pain, persistent bleeding gums, loose teeth'
      ],
      nextSteps: 'Visit a Dentist for evaluation. Don\'t delay treatment for dental infections as they can spread.',
      specialty: 'Dentistry'
    }
  },
  {
    patterns: ['bone pain', 'joint pain', 'knee pain', 'back pain', 'arthritis', 'fracture', 'sprain'],
    topics: ['bone problem', 'joint issue', 'orthopedic'],
    response: {
      title: 'Bone & Joint Health',
      answer: 'Musculoskeletal pain can result from injury, overuse, age-related wear, or underlying conditions like arthritis. The location and nature of pain help determine the cause.',
      details: [
        '**Common Causes:** Muscle strain, ligament sprain, arthritis (osteo or rheumatoid), overuse injuries, poor posture, vitamin D deficiency',
        '**Home Care:** Rest the affected area, apply ice for acute injuries (first 48 hours), gentle stretching, maintain proper posture, ergonomic workspace setup',
        '**Warning Signs:** Joint swelling with fever, inability to bear weight, visible deformity, pain after a fall or injury, progressive weakness'
      ],
      nextSteps: 'Consult an Orthopedist for persistent joint pain, post-injury evaluation, or if pain limits daily activities.',
      specialty: 'Orthopedics'
    }
  },
  {
    patterns: ['ear pain', 'hearing loss', 'ear infection', 'tinnitus', 'ringing ear', 'sinus', 'nasal block'],
    topics: ['ear problem', 'ent issue', 'sinus problem'],
    response: {
      title: 'Ear, Nose & Throat (ENT) Concerns',
      answer: 'ENT symptoms can affect hearing, breathing, swallowing, and overall quality of life. Many conditions respond well to timely treatment.',
      details: [
        '**Common Causes:** Ear infections, sinus congestion, tonsillitis, allergic rhinitis, earwax buildup, noise-induced hearing issues',
        '**Home Care:** Warm compress for ear pain, saline nasal spray for congestion, steam inhalation, stay hydrated, avoid inserting objects into ears',
        '**Warning Signs:** Sudden hearing loss, ear discharge, persistent nosebleeds, difficulty swallowing, lump in the neck'
      ],
      nextSteps: 'Consult an ENT Specialist for persistent or severe symptoms.',
      specialty: 'ENT'
    }
  }
];

// --- General medical knowledge for non-symptom questions ---
const GENERAL_MEDICAL_KNOWLEDGE = [
  {
    topics: ['difference between', 'general physician and a cardiologist', 'general physician', 'cardiologist', 'specialist vs', 'பொது மருத்துவர்'],
    response: {
      title: 'General Physician vs Cardiologist',
      answer: 'Medical doctors undergo specialized training depending on their focus area. Here is a clear breakdown of the difference:',
      details: [
        '**General Physician (Primary Care):** Your first point of contact for common illnesses (fever, cough, body pain, routine infections, fatigue). They provide comprehensive diagnostic evaluations, manage lifestyle diseases, and refer you to specialists when needed.',
        '**Cardiologist (Heart Specialist):** Has advanced specialization exclusively in cardiovascular health — diagnosing and treating heart conditions, severe chest discomfort, high blood pressure (hypertension), arrhythmias, cholesterol issues, and heart attacks.',
        '**When to see a General Physician:** Fever, flu, cold, general weakness, routine health check-up, initial symptom evaluation.',
        '**When to see a Cardiologist:** Persistent or severe chest pain, shortness of breath on exertion, irregular heartbeats/palpitations, family history of heart disease, or unmanaged high blood pressure.'
      ],
      nextSteps: 'Start with a General Physician for initial triage. If heart-specific conditions or persistent high BP are identified, consult a Cardiologist.',
      specialty: 'General Medicine',
      specialtyReason: 'A General Physician can conduct your initial evaluation or refer you to our Cardiologists.'
    }
  },
  {
    topics: ['book appointment', 'book an appointment', 'book doctor', 'booking', 'appointment', 'schedule', 'see doctor', 'visit doctor', 'consult doctor', 'முன்பதிவு'],
    response: {
      title: 'Booking an Appointment with a Doctor',
      answer: 'Yes! You can easily book an appointment with any recommended or registered doctor directly within the MediConnect AI portal.',
      details: [
        '**Direct Booking:** Click the **Book Appointment** button on any recommended doctor card below.',
        '**Browse All Doctors:** Navigate to **Find a Doctor** from the menu to search and filter by specialization, experience, and consultation fees.',
        '**Choose Your Slot:** Select a convenient date and time slot according to the doctor\'s available working hours.',
        '**Teleconsultation:** After booking, confirmed appointments can be attended via live video or audio teleconsultation or in-person visits.'
      ],
      nextSteps: 'Click "Book Appointment" on any doctor card below, or use "Find a Doctor" in the sidebar navigation.',
      specialty: 'General Medicine',
      specialtyReason: 'You can book an appointment with our registered General Physicians or browse all specialists.'
    }
  },
  {
    topics: ['prevention', 'stay healthy', 'healthy lifestyle', 'health tips', 'wellness'],
    response: {
      title: 'General Health & Wellness Tips',
      answer: 'Maintaining good health involves consistent healthy habits across diet, exercise, sleep, and mental wellness.',
      details: [
        '**Nutrition:** Eat a balanced diet with fruits, vegetables, whole grains, and lean proteins. Limit processed foods, added sugars, and excessive salt.',
        '**Physical Activity:** Aim for at least 150 minutes of moderate exercise per week (walking, cycling, swimming). Include strength training 2 days/week.',
        '**Sleep:** Get 7-9 hours of quality sleep. Maintain a consistent sleep schedule and limit screen time before bed.',
        '**Hydration:** Drink 2-3 liters of water daily. More if you\'re physically active or in hot weather.',
        '**Mental Health:** Practice stress management, maintain social connections, take breaks, and don\'t hesitate to seek professional help when needed.',
        '**Preventive Care:** Regular health check-ups, age-appropriate screenings, and staying up-to-date with vaccinations.'
      ],
      nextSteps: 'Consider scheduling a general health check-up with a physician for a baseline assessment.'
    }
  },
  {
    topics: ['medication', 'medicine safety', 'drug interaction', 'side effect', 'self medic'],
    response: {
      title: 'Medication Safety',
      answer: 'Proper medication use is crucial for effective treatment and safety. Always follow your doctor\'s prescription.',
      details: [
        '**Golden Rules:** Never self-prescribe antibiotics or prescription drugs. Complete the full course of prescribed antibiotics. Don\'t share medications.',
        '**Storage:** Store medicines as directed (room temperature, refrigeration, away from sunlight). Check expiry dates regularly.',
        '**Interactions:** Inform your doctor about all medications you\'re taking, including supplements and herbal remedies. Some combinations can be harmful.',
        '**Side Effects:** Report any unusual side effects to your doctor promptly. Don\'t stop prescribed medication suddenly without medical advice.'
      ],
      nextSteps: 'Consult your prescribing doctor or pharmacist for any medication-related questions. MediConnect AI does not prescribe or recommend specific medicines.'
    }
  }
];

// --- Detect emergency symptoms ---
const detectEmergency = (text) => {
  const lower = text.toLowerCase();
  for (const emergency of EMERGENCY_PATTERNS) {
    if (emergency.patterns.some(p => lower.includes(p))) {
      return emergency;
    }
  }
  return null;
};

// --- Recommend specialty based on symptoms ---
const recommendSpecialty = (text) => {
  const lower = text.toLowerCase();
  const matches = [];
  for (const mapping of SYMPTOM_SPECIALTY_MAP) {
    const matchedPatterns = mapping.patterns.filter(p => lower.includes(p));
    if (matchedPatterns.length > 0) {
      matches.push({ ...mapping, matchCount: matchedPatterns.length });
    }
  }
  // Sort by number of matching patterns (most relevant first)
  matches.sort((a, b) => b.matchCount - a.matchCount);
  return matches.length > 0 ? matches : null;
};

// --- Find matching knowledge base entry ---
const findKnowledgeMatch = (text) => {
  const lower = text.toLowerCase();

  // Check specific symptom knowledge first
  for (const entry of LOCAL_KNOWLEDGE_BASE) {
    if (entry.patterns.some(p => lower.includes(p)) ||
        (entry.topics && entry.topics.some(t => lower.includes(t)))) {
      return entry.response;
    }
  }

  // Check general medical knowledge
  for (const entry of GENERAL_MEDICAL_KNOWLEDGE) {
    if (entry.topics.some(t => lower.includes(t))) {
      return entry.response;
    }
  }

  return null;
};

// --- Language detection override from query ---
const detectLanguageOverride = (text) => {
  if (!text) return null;
  const lower = text.toLowerCase();
  if (lower.includes('in tamil') || lower.includes('தமிழில்') || lower.includes('தமிழ்')) return 'Tamil';
  if (lower.includes('in hindi') || lower.includes('हिंदी में') || lower.includes('हिन्दी में') || lower.includes('हिन्दी') || lower.includes('हिंदी')) return 'Hindi';
  if (lower.includes('in telugu') || lower.includes('తెలుగులో') || lower.includes('తెలుగు')) return 'Telugu';
  if (lower.includes('in malayalam') || lower.includes('മലയാളത്തിൽ') || lower.includes('മലയാളം')) return 'Malayalam';
  if (lower.includes('in kannada') || lower.includes('ಕನ್ನಡದಲ್ಲಿ') || lower.includes('ಕನ್ನಡ')) return 'Kannada';
  if (lower.includes('in english')) return 'English';
  return null;
};

// --- Local Multilingual Clinical Translator ---
const LOCAL_TRANSLATIONS = {
  Tamil: {
    emergency: {
      title: '🚨 அவசர மருத்துவ நிலை – உடனடி உதவி பெறவும்',
      answer: 'நீங்கள் விவரித்த அறிகுறிகளின் அடிப்படையில், இது உடனடியாக கவனிக்கப்பட வேண்டிய மருத்துவ அவசர நிலையாக இருக்கலாம். தயவுசெய்து மருத்துவ உதவியை தாமதப்படுத்தாதீர்கள்.',
      details: [
        '**உடனடியாக அழைக்கவும்:** 112 (தேசிய அவசர எண்) அல்லது 108 (ஆம்புலன்ஸ்) உடனடியாக அழைக்கவும்.',
        '**சுயமாக வாகனம் ஓட்ட வேண்டாம்.** வேறு யாராவது உங்களை மருத்துவமனைக்கு அழைத்துச் செல்லட்டும் அல்லது ஆம்புலன்ஸுக்கு காத்திருங்கள்.',
        '**அமைதியாக இருக்கவும்** மற்றும் வசதியான நிலையில் ஓய்வெடுக்கவும்.',
        '**அருகில் உள்ளவர்களிடம் தெரிவிக்கவும்,** அப்போதுதான் அவசர மருத்துவப் பணியாளர்களுக்கு நிலைமையை விளக்க முடியும்.'
      ],
      nextSteps: 'இதை வீட்டில் சுயமாக நிர்வகிக்க முடியாது. உடனடி அவசர மருத்துவ சிகிச்சையே முதன்மையானது.',
      specialtyReason: 'அவசர அறிகுறிகள் கண்டறியப்பட்டுள்ளன — வழக்கமான முன்பதிவை விட உடனடி அவசர சிகிச்சைக்கு முன்னுரிமை அளிக்கப்படுகிறது.'
    },
    headache: {
      title: 'தலைவலி மற்றும் காய்ச்சல் வழிகாட்டல்',
      answer: 'தலைவலி மற்றும் மிதமான காய்ச்சல் நீரிழப்பு, அதிக சோர்வு, மன அழுத்தம், வைரஸ் தொற்று அல்லது தூக்கமின்மை காரணமாக ஏற்படலாம்.',
      details: [
        '**பொதுவான காரணங்கள்:** வைரஸ் காய்ச்சல், நீரிழப்பு, அதிக வெயில், தூக்கமின்மை, கண் சோர்வு, மன அழுத்தம்.',
        '**வீட்டுப் பராமரிப்பு:** போதிய ஓய்வு எடுக்கவும், அதிகளவில் தண்ணீர் மற்றும் திரவ உணவுகளை பருகவும், குளிர்ந்த ஒத்தடம் கொடுக்கவும்.',
        '**எச்சரிக்கை அறிகுறிகள்:** காய்ச்சல் 3 நாட்களுக்கு மேல் நீடித்தால், கடுமையான கழுத்து வலி அல்லது மூச்சுத்திணறல் இருந்தால் மருத்துவரை அணுகவும்.'
      ],
      nextSteps: 'அறிகுறிகள் தொடர்ந்தால் பொது மருத்துவரை (General Physician) அணுகவும்.',
      specialtyReason: 'பொதுவான அறிகுறிகளை பரிசோதிக்க பொது மருத்துவர் பரிந்துரைக்கப்படுகிறார்.'
    },
    skin: {
      title: 'தோல் தடிப்பு மற்றும் ஒவ்வாமை',
      answer: 'தோல் தடிப்பு மற்றும் அரிப்பு ஒவ்வாமை, பூஞ்சை தொற்று அல்லது சுற்றுச்சூழல் காரணங்களால் ஏற்படலாம்.',
      details: [
        '**பொதுவான காரணங்கள்:** ஒவ்வாமை (Allergy), எக்ஸிமா, பூஞ்சை தொற்று, பூச்சி கடி, வெப்ப தடிப்பு.',
        '**பராமரிப்பு:** அப்பகுதியை சுத்தமாகவும் உலர்வாகவும் வைக்கவும், சொறிவதை தவிர்க்கவும், பருத்தி ஆடைகளை அணியவும்.',
        '**எச்சரிக்கை அறிகுறிகள்:** தடிப்புடன் காய்ச்சல், கொப்புளங்கள் அல்லது சீழ் வடிந்தால் தாமதிக்காமல் தோல் மருத்துவரை அணுகவும்.'
      ],
      nextSteps: 'தோல் நிபுணரை (Dermatologist) அணுகி சரியான பரிசோதனை பெற பரிந்துரைக்கிறோம்.',
      specialtyReason: 'தோல் தொடர்பான பிரச்சினைகளுக்கு தோல் மருத்துவரை அணுகவும்.'
    },
    bp: {
      title: 'உயர் இரத்த அழுத்தம் (Blood Pressure) விளக்கம்',
      answer: 'இரத்த அழுத்தம் என்பது தமனிகளின் சுவர்களில் இரத்தம் செலுத்தும் விசையை அளவிடுவதாகும். சாதாரண அளவு 120/80 mmHg ஆகும். தொடர்ந்து 130/80 க்கு மேல் இருப்பது உயர் இரத்த அழுத்தம் எனப்படுகிறது.',
      details: [
        '**அளவுகள்:** இயல்பான அளவு (<120/80), உயர் அளவு (130-139/80-89), தீவிர நிலை (≥140/≥90).',
        '**வாழ்க்கை முறை மேலாண்மை:** உப்பின் அளவைக் குறைக்கவும், தினசரி 30 நிமிடம் நடைப்பயிற்சி செய்யவும், மன அழுத்தத்தை குறைக்கவும்.',
        '**ஏன் முக்கியம்:** கட்டுப்படுத்தப்படாத உயர் இரத்த அழுத்தம் இதயம் மற்றும் பக்கவாதம் ஏற்படும் அபாயத்தை அதிகரிக்கிறது.'
      ],
      nextSteps: 'இதய நோய் நிபுணரை (Cardiologist) அல்லது பொது மருத்துவரை அணுகி வழக்கமான பரிசோதனை செய்து கொள்ளவும்.',
      specialtyReason: 'இரத்த அழுத்தம் மற்றும் இதய ஆரோக்கியத்தை பரிசோதிக்க இதய மருத்துவர் பரிந்துரைக்கப்படுகிறார்.'
    },
    booking: {
      title: 'மருத்துவரிடம் முன்பதிவு செய்தல்',
      answer: 'ஆம்! மெடிகனெக்ட் தளத்தில் பதிவுபெற்ற எந்தவொரு மருத்துவரோடும் நீங்கள் நேரடியாக முன்பதிவு செய்யலாம்.',
      details: [
        '**நேரடி முன்பதிவு:** கீழே பரிந்துரைக்கப்பட்டுள்ள மருத்துவர் அட்டையில் உள்ள **முன்பதிவு செய்க** பொத்தானை கிளிக் செய்யவும்.',
        '**மருத்துவர்களை கண்டறிய:** இடது மெனுவில் உள்ள **மருத்துவரை கண்டறிய** பகுதிக்கு சென்று சிறப்பு பிரிவு மற்றும் கட்டணங்களை பார்த்து தேர்ந்தெடுக்கலாம்.',
        '**தொலைமருத்துவம்:** முன்பதிவு செய்த பிறகு வீடியோ அல்லது ஆடியோ மூலம் தொலைமருத்துவ ஆலோசனையில் இணையலாம்.'
      ],
      nextSteps: 'கீழே உள்ள மருத்துவர் அட்டையில் முன்பதிவு பொத்தானை கிளிக் செய்யவும் அல்லது மெனுவில் உள்ள மருத்துவரை கண்டறிய பகுதிக்கு செல்லவும்.',
      specialtyReason: 'பொது மருத்துவர் அல்லது சிறப்பு மருத்துவரிடம் முன்பதிவு செய்து ஆலோசனை பெறலாம்.'
    },
    gp_vs_cardio: {
      title: 'பொது மருத்துவர் vs இதய மருத்துவர் வேறுபாடு',
      answer: 'பொது மருத்துவர் மற்றும் இதய மருத்துவருக்கான முக்கிய வேறுபாடுகள்:',
      details: [
        '**பொது மருத்துவர் (General Physician):** காய்ச்சல், சளி, இருமல் மற்றும் பொதுவான உடல்நலக் கோளாறுகளுக்கான முதன்மை மருத்துவர். ஆரம்ப பரிசோதனைக்கு இவரே பொருத்தமானவர்.',
        '**இதய மருத்துவர் (Cardiologist):** இதயம், இரத்த நாளங்கள், கடுமையான மார்பு வலி மற்றும் உயர் இரத்த அழுத்தம் தொடர்பான சிறப்பு மருத்துவர்.'
      ],
      nextSteps: 'பொதுவான உடல்நலக்குறைவுக்கு பொது மருத்துவரை அணுகவும்; இதயக் கோளாறுகளுக்கு இதய மருத்துவரை அணுகவும்.',
      specialtyReason: 'ஆரம்ப பரிசோதனைக்கு பொது மருத்துவரை அணுகலாம்.'
    },
    general: {
      title: 'பொதுவான சுகாதார வழிகாட்டல்',
      answer: 'உங்கள் சுகாதார கேள்விக்கு நன்றி. துல்லியமான வழிகாட்டலுக்கு உங்கள் அறிகுறிகளை தெளிவாக விவரிக்கவும்.',
      details: [
        '**கூடுதல் விவரங்கள்:** அறிகுறிகள் எப்போது தொடங்கியது, எவ்வளவு காலம் உள்ளது என்பதை விவரிக்கவும்.',
        '**நல்வாழ்வு:** சமச்சீரான உணவு, தினசரி உடற்பயிற்சி, 7-8 மணிநேர தூக்கம் மற்றும் போதுமான தண்ணீர் குடிப்பது அவசியம்.',
        '**மருத்துவ ஆலோசனை:** அறிகுறிகள் தொடர்ந்தால் தகுதியான மருத்துவரை அணுகவும்.'
      ],
      nextSteps: 'உங்கள் அறிகுறிகளை மேலும் விவரிக்கவும் அல்லது "மருத்துவரை கண்டறிய" பகுதிக்கு செல்லவும்.',
      specialtyReason: 'பொதுவான பரிசோதனைக்கு பொது மருத்துவர் பரிந்துரைக்கப்படுகிறார்.'
    }
  },
  Hindi: {
    emergency: {
      title: '🚨 आपातकाल – तुरंत चिकित्सा सहायता लें',
      answer: 'आपके द्वारा वर्णित लक्षण संभावित रूप से जानलेवा आपातकाल का संकेत दे सकते हैं। कृपया तुरंत चिकित्सा सहायता लें।',
      details: [
        '**तुरंत आपातकालीन सेवाओं को कॉल करें:** 112 (राष्ट्रीय आपातकाल) या 108 (एम्बुलेंस) डायल करें।',
        '**स्वयं गाड़ी न चलाएं।** किसी अन्य को अस्पताल ले जाने दें या एम्बुलेंस की प्रतीक्षा करें।',
        '**शांत रहें** और आरामदायक स्थिति में बैठें या लेटें।',
        '**आसपास के लोगों को सूचित करें** ताकि वे आपातकालीन कर्मियों को आवश्यक जानकारी दे सकें।'
      ],
      nextSteps: 'इसे घर पर प्रबंधित नहीं किया जा सकता। तत्काल आपातकालीन चिकित्सा देखभाल सर्वोच्च प्राथमिकता है।',
      specialtyReason: 'आपातकालीन लक्षण पाए गए — नियमित अपॉइंटमेंट की तुलना में तत्काल देखभाल को प्राथमिकता दी गई।'
    },
    headache: {
      title: 'सिरदर्द और हल्का बुखार का मार्गदर्शन',
      answer: 'सिरदर्द और हल्का बुखार निर्जलीकरण, तनाव, वायरल संक्रमण, नींद की कमी या थकान के कारण हो सकता है।',
      details: [
        '**सामान्य कारण:** वायरल बुखार, निर्जलीकरण (Dehydration), धूप में रहना, नींद की कमी, तनाव।',
        '**घरेलू देखभाल:** पर्याप्त आराम करें, खूब पानी और तरल पदार्थ पिएं, माथे पर ठंडा सेक लगाएं।',
        '**चेतावनी संकेत:** बुखार 3 दिनों से अधिक रहे, गर्दन में अकड़न या सांस लेने में तकलीफ हो तो तुरंत डॉक्टर से मिलें।'
      ],
      nextSteps: 'लक्षण बने रहने पर जनरल फिजिशियन (General Physician) से परामर्श लें।',
      specialtyReason: 'सामान्य मूल्यांकन के लिए जनरल फिजिशियन की सिफारिश की जाती है।'
    },
    skin: {
      title: 'त्वचा के चकत्ते और समस्याएं',
      answer: 'त्वचा पर चकत्ते और खुजली एलर्जी, फंगल संक्रमण या पर्यावरणीय कारणों से हो सकती है।',
      details: [
        '**सामान्य कारण:** एलर्जी, एक्जिमा, फंगल इन्फेक्शन, कीड़े का काटना, गर्मी के दाने।',
        '**देखभाल:** प्रभावित क्षेत्र को साफ और सूखा रखें, खुजलाने से बचें, सूती कपड़े पहनें।',
        '**चेतावनी संकेत:** चकत्तों के साथ तेज बुखार, फफोले या मवाद होने पर तुरंत त्वचा विशेषज्ञ से मिलें।'
      ],
      nextSteps: 'उचित निदान के लिए त्वचा विशेषज्ञ (Dermatologist) से परामर्श लें।',
      specialtyReason: 'त्वचा संबंधी समस्याओं के लिए त्वचा विशेषज्ञ की सिफारिश की जाती है।'
    },
    bp: {
      title: 'रक्तचाप (Blood Pressure) को समझना',
      answer: 'रक्तचाप धमनियों की दीवारों पर रक्त द्वारा डाले जाने वाले दबाव का माप है। सामान्य माप लगभग 120/80 mmHg होता है। लगातार 130/80 से अधिक होना उच्च रक्तचाप माना जाता है।',
      details: [
        '**श्रेणियां:** सामान्य (<120/80), बढ़ा हुआ (130-139/80-89), उच्च स्टेज 2 (≥140/≥90)।',
        '**जीवनशैली प्रबंधन:** नमक का सेवन कम करें, प्रतिदिन 30 मिनट व्यायाम करें, तनाव नियंत्रित करें।',
        '**महत्व:** अनियंत्रित उच्च रक्तचाप दिल के दौरे और स्ट्रोक के जोखिम को बढ़ाता है।'
      ],
      nextSteps: 'नियमित निगरानी के लिए कार्डियोलॉजिस्ट (Cardiologist) या जनरल फिजिशियन से परामर्श लें।',
      specialtyReason: 'रक्तचाप और हृदय स्वास्थ्य के लिए हृदय विशेषज्ञ की सिफारिश की जाती है।'
    },
    booking: {
      title: 'डॉक्टर के साथ अपॉइंटमेंट बुक करना',
      answer: 'हाँ! आप मेडिकनेक्ट पोर्टल पर हमारे किसी भी पंजीकृत डॉक्टर के साथ सीधे अपॉइंटमेंट बुक कर सकते हैं।',
      details: [
        '**सीधी बुकिंग:** नीचे डॉक्टर कार्ड पर दिए गए **अपॉइंटमेंट बुक करें** बटन पर क्लिक करें।',
        '**डॉक्टर खोजें:** विशेषता, अनुभव और शुल्क के आधार पर ब्राउज़ करने के लिए मेनू में **डॉक्टर खोजें** पर जाएं।',
        '**टेली-परामर्श:** बुकिंग के बाद वीडियो या ऑडियो कॉल द्वारा ऑनलाइन परामर्श में शामिल हों।'
      ],
      nextSteps: 'नीचे डॉक्टर कार्ड पर "अपॉइंटमेंट बुक करें" पर क्लिक करें या साइडबार में "डॉक्टर खोजें" पर जाएं।',
      specialtyReason: 'आप जनरल फिजिशियन या किसी भी विशेषज्ञ के साथ अपॉइंटमेंट बुक कर सकते हैं।'
    },
    gp_vs_cardio: {
      title: 'जनरल फिजिशियन और कार्डियोलॉजिस्ट में अंतर',
      answer: 'जनरल फिजिशियन और कार्डियोलॉजिस्ट के बीच मुख्य अंतर निम्नलिखित हैं:',
      details: [
        '**जनरल फिजिशियन (General Physician):** बुखार, खांसी, जुकाम और सामान्य बीमारियों के लिए प्राथमिक डॉक्टर हैं।',
        '**कार्डियोलॉजिस्ट (Cardiologist):** हृदय, रक्त वाहिकाओं, गंभीर सीने के दर्द और उच्च रक्तचाप के विशेषज्ञ डॉक्टर हैं।'
      ],
      nextSteps: 'सामान्य समस्याओं के लिए जनरल फिजिशियन से शुरू करें; हृदय संबंधी समस्याओं के लिए कार्डियोलॉजिस्ट से परामर्श लें।',
      specialtyReason: 'प्राथमिक जांच के लिए जनरल फिजिशियन उपयुक्त हैं।'
    },
    general: {
      title: 'सामान्य स्वास्थ्य मार्गदर्शन',
      answer: 'आपके स्वास्थ्य प्रश्न के लिए धन्यवाद। अधिक सटीक जानकारी के लिए अपने लक्षणों का विस्तार से वर्णन करें।',
      details: [
        '**अधिक जानकारी दें:** लक्षण कब शुरू हुए और कितने समय से हैं, यह बताएं।',
        '**स्वस्थ आदतें:** संतुलित आहार, नियमित व्यायाम, 7-8 घंटे की नींद और पर्याप्त पानी पिएं।',
        '**डॉक्टर से परामर्श:** लगातार रहने वाले लक्षणों के लिए हमेशा योग्य डॉक्टर से मिलें।'
      ],
      nextSteps: 'अपने लक्षणों का विस्तार से वर्णन करें या "डॉक्टर खोजें" में उपलब्ध डॉक्टरों को देखें।',
      specialtyReason: 'सामान्य स्वास्थ्य परामर्श के लिए जनरल फिजिशियन की सिफारिश की जाती है।'
    }
  },
  Telugu: {
    emergency: {
      title: '🚨 అత్యవసర పరిస్థితి – వెంటనే వైద్య సహాయం పొందండి',
      answer: 'మీరు వివరించిన లక్షణాలు ప్రాణాంతక అత్యవసర పరిస్థితిని సూచించవచ్చు. దయచేసి వెంటనే వైద్య సహాయం పొందండి.',
      details: [
        '**వెంటనే అత్యవసర సేవలకు కాల్ చేయండి:** 112 లేదా 108 కు వెంటనే కాల్ చేయండి.',
        '**మీరే స్వయంగా డ్రైవ్ చేయవద్దు.** అంబులెన్స్ కోసం వేచి ఉండండి లేదా వేరొకరిని తీసుకెళ్లనివ్వండి.',
        '**ప్రశాంతంగా ఉండండి** మరియు సౌకర్యవంతమైన స్థితిలో విశ్రాంతి తీసుకోండి.'
      ],
      nextSteps: 'దీన్ని ఇంట్లో నిర్వహించలేరు. తక్షణ అత్యవసర వైద్య సంరక్షణే ప్రాధాన్యత.',
      specialtyReason: 'అత్యవసర లక్షణాలు గుర్తించబడ్డాయి — తక్షణ అత్యవసర సంరక్షణకు ప్రాధాన్యత.'
    },
    headache: {
      title: 'తలనొప్పి మరియు తేలికపాటి జ్వరం మార్గదర్శకత్వం',
      answer: 'తలనొప్పి మరియు తేలికపాటి జ్వరం డీహైడ్రేషన్, ఒత్తిడి, వైరల్ ఇన్ఫెక్షన్ లేదా నిద్రలేమి కారణంగా రావచ్చు.',
      details: [
        '**సాధారణ కారణాలు:** వైరల్ జ్వరం, డీహైడ్రేషన్, ఎండలో తిరగడం, నిద్రలేమి, ఒత్తిడి.',
        '**ఇంటి సంరక్షణ:** తగినంత విశ్రాంతి తీసుకోండి, పుష్కలంగా నీరు త్రాగండి.',
        '**హెచ్చరిక సంకేతాలు:** జ్వరం 3 రోజులకు మించి కొనసాగితే లేదా శ్వాస తీసుకోవడంలో ఇబ్బంది ఉంటే వైద్యుడిని సంప్రదించండి.'
      ],
      nextSteps: 'లక్షణాలు కొనసాగితే జనరల్ ఫిజీషియన్ (General Physician) ను సంప్రదించండి.',
      specialtyReason: 'ప్రాథమిక మూల్యాంకనం కోసం జనరల్ ఫిజీషియన్ సిఫార్సు చేయబడ్డారు.'
    },
    skin: {
      title: 'చర్మ దద్దుర్లు మరియు సమస్యలు',
      answer: 'చర్మంపై దద్దుర్లు మరియు దురద అలెర్జీలు లేదా ఇన్ఫెక్షన్ల వల్ల రావచ్చు.',
      details: [
        '**కారణాలు:** అలెర్జీలు, ఎగ్జిమా, ఫంగల్ ఇన్ఫెక్షన్లు, వేడి దద్దుర్లు.',
        '**సంరక్షణ:** ఆ ప్రాంతాన్ని శుభ్రంగా ఉంచండి, గోకడం మానుకోండి.',
        '**హెచ్చరికలు:** దద్దుర్లతో పాటు జ్వరం లేదా పొక్కులు ఉంటే చర్మవ్యాధి నిపుణుడిని సంప్రదించండి.'
      ],
      nextSteps: 'చర్మవ్యాధి నిపుణుడిని (Dermatologist) సంప్రదించండి.',
      specialtyReason: 'చర్మ సమస్యల కోసం డెర్మటాలజిస్ట్ సిఫార్సు చేయబడ్డారు.'
    },
    bp: {
      title: 'రక్తపోటు (Blood Pressure) అవగాహన',
      answer: 'రక్తపోటు సాధారణ స్థాయి సుమారు 120/80 mmHg. నిరంతరం 130/80 పైన ఉండటం అధిక రక్తపోటుగా పరిగణించబడుతుంది.',
      details: [
        '**వర్గాలు:** సాధారణం (<120/80), అధికం (≥130/80).',
        '**జీవనశైలి:** ఉప్పు తగ్గించండి, రోజూ 30 నిమిషాలు వ్యాయామం చేయండి, ఒత్తిడి తగ్గించండి.'
      ],
      nextSteps: 'కార్డియాలజిస్ట్ లేదా జనరల్ ఫిజీషియన్ ను సంప్రదించండి.',
      specialtyReason: 'గుండె మరియు రక్తపోటు కోసం కార్డియాలజిస్ట్ సిఫార్సు చేయబడ్డారు.'
    },
    booking: {
      title: 'వైద్యుడితో అపాయింట్‌మెంట్ బుక్ చేయడం',
      answer: 'అవును! మీరు మెడికనెక్ట్ పోర్టల్‌లో నేరుగా అపాయింట్‌మెంట్ బుక్ చేసుకోవచ్చు.',
      details: [
        '**నేరుగా బుక్ చేయండి:** కింద ఉన్న డాక్టర్ కార్డ్‌పై **అపాయింట్‌మెంట్ బుక్ చేయండి** క్లిక్ చేయండి.',
        '**వైద్యులను శోధించండి:** స్పెషాలిటీ ప్రకారం బ్రౌజ్ చేయడానికి మెనూలోని **వైద్యుడిని కనుగొనండి** కి వెళ్లండి.'
      ],
      nextSteps: 'కింది డాక్టర్ కార్డ్‌పై క్లిక్ చేయండి లేదా వైద్యుడిని కనుగొనండి కి వెళ్లండి.',
      specialtyReason: 'జనరల్ ఫిజీషియన్ లేదా నిపుణులతో అపాయింట్‌మెంట్ బుక్ చేసుకోవచ్చు.'
    },
    gp_vs_cardio: {
      title: 'జనరల్ ఫిజీషియన్ మరియు కార్డియాలజిస్ట్ తేడాలు',
      answer: 'జనరల్ ఫిజీషియన్ సాధారణ ఆరోగ్య సమస్యలకు మొదటి సంప్రదింపుదారు; కార్డియాలజిస్ట్ గుండె మరియు రక్తనాళాల ప్రత్యేక నిపుణుడు.',
      details: [
        '**జనరల్ ఫిజీషియన్:** జ్వరం, దగ్గు, జలుబు మరియు సాధారణ అనారోగ్యాలు.',
        '**కార్డియాలజిస్ట్:** గుండె జబ్బులు, ఛాతీ నొప్పి మరియు అధిక రక్తపోటు.'
      ],
      nextSteps: 'సాధారణ సమస్యలకు జనరల్ ఫిజీషియన్ తో ప్రారంభించండి.',
      specialtyReason: 'ప్రాథమిక సంప్రదింపులకు జనరల్ ఫిజీషియన్ సిఫార్సు చేయబడ్డారు.'
    },
    general: {
      title: 'సాధారణ ఆరోగ్య మార్గదర్శకత్వం',
      answer: 'ఖచ్చితమైన మార్గదర్శకత్వం కోసం మీ లక్షణాలను వివరంగా పేర్కొనండి.',
      details: [
        'సమతుల్య ఆహారం, రోజూ వ్యాయామం, 7-8 గంటల నిద్ర మరియు తగినంత నీరు త్రాగడం ముఖ్యం.'
      ],
      nextSteps: 'మీ లక్షణాలను వివరించండి లేదా వైద్యుడిని కనుగొనండి కి వెళ్లండి.',
      specialtyReason: 'జనరల్ ఫిజీషియన్ సిఫార్సు చేయబడ్డారు.'
    }
  },
  Malayalam: {
    emergency: {
      title: '🚨 അടിയന്തരാവസ്ഥ – ഉടൻ വൈദ്യസഹായം തേടുക',
      answer: 'നിങ്ങൾ വിവരിച്ച ലക്ഷണങ്ങൾ ജീവന് തന്നെ ഭീഷണിയായേക്കാവുന്ന അടിയന്തരാവസ്ഥയെ സൂചിപ്പിക്കുന്നു. ഉടൻ തന്നെ അടിയന്തിര ചികിത്സ തേടുക.',
      details: [
        '**ഉടൻ തന്നെ വിളിക്കുക:** 112 അല്ലെങ്കിൽ 108 ഉടൻ ഡയൽ ചെയ്യുക.',
        '**സ്വയം വാഹനം ഓടിക്കരുത്.** ആംബുലൻസിനായി കാത്തിരിക്കുക അല്ലെങ്കിൽ മറ്റാരെങ്കിലും ആശുപത്രിയിലെത്തിക്കട്ടെ.',
        '**ശാന്തമായി ഇരിക്കുക** ഒപ്പം സുഖപ്രദമായ സ്ഥാനത്ത് വിശ്രമിക്കുക.'
      ],
      nextSteps: 'ഇത് വീട്ടിലിരുന്ന് ചികിത്സിക്കേണ്ട ഒന്നല്ല. അടിയന്തിര ചികിത്സയാണ് പ്രധാനം.',
      specialtyReason: 'അടിയന്തിര ലക്ഷണങ്ങൾ കണ്ടെത്തി — അടിയന്തിര ചികിത്സയ്ക്ക് മുൻഗണന.'
    },
    headache: {
      title: 'തലവേദനയും നേരിയ പനിയും മാർഗ്ഗനിർദ്ദേശം',
      answer: 'തലവേദനയും നേരിയ പനിയും നിർജ്ജലീകരണം, സമ്മർദ്ദം, വൈറൽ അണുബാധ അല്ലെങ്കിൽ ഉറക്കക്കുറവ് എന്നിവ കാരണം ഉണ്ടാകാം.',
      details: [
        '**കാരണങ്ങൾ:** വൈറൽ പനി, നിർജ്ജലീകരണം, ഉറക്കക്കുറവ്, സമ്മർദ്ദം.',
        '**പരിചരണം:** ധാരാളം വെള്ളം കുടിക്കുക, വിശ്രമിക്കുക.',
        '**മുന്നറിയിപ്പ്:** പനി 3 ദിവസത്തിൽ കൂടുതൽ നീണ്ടുനിന്നാൽ ഡോക്ടറെ കാണുക.'
      ],
      nextSteps: 'ജനറൽ ഫിസിഷ്യനെ (General Physician) സമീപിക്കുക.',
      specialtyReason: 'പ്രാഥമിക പരിശോധനയ്ക്ക് ജനറൽ ഫിസിഷ്യനെ ശുപാർശ ചെയ്യുന്നു.'
    },
    skin: {
      title: 'ചർമ്മത്തിലെ തിണർപ്പും പ്രശ്നങ്ങളും',
      answer: 'ചർമ്മത്തിലെ അലർജി, ഫംഗസ് അണുബാധ അല്ലെങ്കിൽ ചൊറിച്ചിൽ എന്നിവയ്ക്ക് ചർമ്മരോഗ വിദഗ്ദ്ധനെ കാണുക.',
      details: [
        'ബാധിച്ച ഭാഗം വൃത്തിയായി സൂക്ഷിക്കുക, ചൊറിയുന്നത് ഒഴിവാക്കുക.'
      ],
      nextSteps: 'ഡെർമറ്റോളജിസ്റ്റിനെ (Dermatologist) സമീപിക്കുക.',
      specialtyReason: 'ചർമ്മ സംബന്ധമായ പ്രശ്നങ്ങൾക്ക് ഡെർമറ്റോളജിസ്റ്റ് ശുപാർശ ചെയ്യുന്നു.'
    },
    bp: {
      title: 'രക്തസമ്മർദ്ദം (Blood Pressure) മനസ്സിലാക്കുക',
      answer: 'സാധാരണ രക്തസമ്മർദ്ദം 120/80 mmHg ആണ്. 130/80 ന് മുകളിലുള്ള അളവ് ഉയർന്ന രക്തസമ്മർദ്ദമാണ്.',
      details: [
        'ഉപ്പ് കുറയ്ക്കുക, ദിവസവും വ്യായാമം ചെയ്യുക, സമ്മർദ്ദം നിയന്ത്രിക്കുക.'
      ],
      nextSteps: 'കാർഡിയോളജിസ്റ്റിനെയോ ജനറൽ ഫിസിഷ്യനെയോ സമീപിക്കുക.',
      specialtyReason: 'ഹൃദയാരോഗ്യത്തിനായി കാർഡിയോളജിസ്റ്റിനെ ശുപാർശ ചെയ്യുന്നു.'
    },
    booking: {
      title: 'ഡോക്ടറുമായി അപ്പോയിന്റ്മെന്റ് ബുക്ക് ചെയ്യുക',
      answer: 'അതെ! മെഡികണക്ട് പോർട്ടലിലൂടെ നിങ്ങൾക്ക് നേരിട്ട് ഡോക്ടറെ ബുക്ക് ചെയ്യാം.',
      details: [
        'താഴെയുള്ള ഡോക്ടർ കാർഡിലെ **അപ്പോയിന്റ്മെന്റ് ബുക്ക് ചെയ്യുക** ക്ലിക്ക് ചെയ്യുക.',
        'കൂടുതൽ ഡോക്ടർമാർക്കായി **ഡോക്ടറെ കണ്ടെത്തുക** മെനു സന്ദർശിക്കുക.'
      ],
      nextSteps: 'ഡോക്ടർ കാർഡിലെ ബട്ടൺ ക്ലിക്ക് ചെയ്യുക.',
      specialtyReason: 'ജനറൽ ഫിസിഷ്യനെയോ മറ്റ് സ്പെഷ്യലിസ്റ്റുകളെയോ ബുക്ക് ചെയ്യാം.'
    },
    gp_vs_cardio: {
      title: 'ജനറൽ ഫിസിഷ്യനും കാർഡിയോളജിസ്റ്റും തമ്മിലുള്ള വ്യത്യാസം',
      answer: 'ജനറൽ ഫിസിഷ്യൻ പ്രാഥമിക ആരോഗ്യ പ്രശ്നങ്ങൾക്കുള്ള ഡോക്ടറാണ്; കാർഡിയോളജിസ്റ്റ് ഹൃദയസംബന്ധമായ രോഗങ്ങളുടെ വിദഗ്ദ്ധനാണ്.',
      details: [
        'പനി, ജലദോഷം എന്നിവയ്ക്ക് ജനറൽ ഫിസിഷ്യനെയും ഹൃദ്രോഗത്തിന് കാർഡിയോളജിസ്റ്റിനെയും കാണുക.'
      ],
      nextSteps: 'ജനറൽ ഫിസിഷ്യനെ ആദ്യം സമീപിക്കുക.',
      specialtyReason: 'പ്രാഥമിക പരിശോധനയ്ക്ക് ജനറൽ ഫിസിഷ്യനെ ശുപാർശ ചെയ്യുന്നു.'
    },
    general: {
      title: 'പൊതുവായ ആരോഗ്യ മാർഗ്ഗനിർദ്ദേശം',
      answer: 'കൂടുതൽ വിവരങ്ങൾക്ക് ലക്ഷണങ്ങൾ വ്യക്തമായി രേഖപ്പെടുത്തുക.',
      details: [
        'സമീകൃതാഹാരം, പതിവ് വ്യായാമം, ആവശ്യത്തിന് ഉറക്കം എന്നിവ പാലിക്കുക.'
      ],
      nextSteps: 'ഡോക്ടറെ കണ്ടെത്തുക മെനു സന്ദർശിക്കുക.',
      specialtyReason: 'ജനറൽ ഫിസിഷ്യനെ ശുപാർശ ചെയ്യുന്നു.'
    }
  },
  Kannada: {
    emergency: {
      title: '🚨 ತುರ್ತು ಪರಿಸ್ಥಿತಿ – ತಕ್ಷಣ ವೈದ್ಯಕೀಯ ಸಹಾಯ ಪಡೆಯಿರಿ',
      answer: 'ನೀವು ವಿವರಿಸಿದ ರೋಗಲಕ್ಷಣಗಳು ಪ್ರಾಣಾಪಾಯದ ತುರ್ತುಸ್ಥಿತಿಯನ್ನು ಸೂಚಿಸುತ್ತವೆ. ದಯವಿಟ್ಟು ತಕ್ಷಣವೇ ತುರ್ತು ವೈದ್ಯಕೀಯ ಸಹಾಯವನ್ನು ಪಡೆಯಿರಿ.',
      details: [
        '**ತಕ್ಷಣ ಕರೆ ಮಾಡಿ:** 112 ಅಥವಾ 108 ಗೆ ತಕ್ಷಣ ಕರೆ ಮಾಡಿ.',
        '**ಸ್ವತಃ ವಾಹನ ಚಲಾಯಿಸಬೇಡಿ.** ಆಂಬ್ಯುಲೆನ್ಸ್‌ಗಾಗಿ ಕಾಯಿರಿ ಅಥವಾ ಬೇರೆಯವರು ಆಸ್ಪತ್ರೆಗೆ ಕರೆದೊಯ್ಯಲಿ.',
        '**ಶಾಂತರಾಗಿರಿ** ಮತ್ತು ಆರಾಮದಾಯಕವಾಗಿ ವಿಶ್ರಾಂತಿ ಪಡೆಯಿರಿ.'
      ],
      nextSteps: 'ಇದನ್ನು ಮನೆಯಲ್ಲಿ ನಿಭಾಯಿಸಲು ಸಾಧ್ಯವಿಲ್ಲ. ತಕ್ಷಣದ ತುರ್ತು ಆರೈಕೆಯೇ ಪ್ರಮುಖ ಆದ್ಯತೆ.',
      specialtyReason: 'ತುರ್ತು ರೋಗಲಕ್ಷಣಗಳು ಪತ್ತೆಯಾಗಿವೆ — ತಕ್ಷಣದ ಆರೈಕೆಗೆ ಆದ್ಯತೆ.'
    },
    headache: {
      title: 'ತಲೆನೋವು ಮತ್ತು ಸೌಮ್ಯ ಜ್ವರದ ಮಾರ್ಗದರ್ಶನ',
      answer: 'ತಲೆನೋವು ಮತ್ತು ಸೌಮ್ಯ ಜ್ವರ ನಿರ್ಜಲೀಕರಣ, ಒತ್ತಡ, ವೈರಲ್ ಸೋಂಕು ಅಥವಾ ನಿದ್ರೆಯ ಕೊರತೆಯಿಂದ ಉಂಟಾಗಬಹುದು.',
      details: [
        '**ಕಾರಣಗಳು:** ವೈರಲ್ ಜ್ವರ, ನಿರ್ಜಲೀಕರಣ, ನಿದ್ರೆಯ ಕೊರತೆ, ಒತ್ತಡ.',
        '**ಆರೈಕೆ:** ಸಾಕಷ್ಟು ನೀರು ಕುಡಿಯಿರಿ, ವಿಶ್ರಾಂತಿ ತೆಗೆದುಕೊಳ್ಳಿ.',
        '**ಎಚ್ಚರಿಕೆ:** ಜ್ವರ 3 ದಿನಗಳಿಗಿಂತ ಹೆಚ್ಚು ಮುಂದುವರಿದರೆ ವೈದ್ಯರನ್ನು ಭೇಟಿ ಮಾಡಿ.'
      ],
      nextSteps: 'ಜನರಲ್ ಫಿಸಿಶಿಯನ್ (General Physician) ರನ್ನು ಸಂಪರ್ಕಿಸಿ.',
      specialtyReason: 'ಸಾಮಾನ್ಯ ತಪಾಸಣೆಗಾಗಿ ಜನರಲ್ ಫಿಸಿಶಿಯನ್ ಶಿಫಾರಸು ಮಾಡಲಾಗಿದೆ.'
    },
    skin: {
      title: 'ಚರ್ಮದ ದದ್ದುಗಳು ಮತ್ತು ಸಮಸ್ಯೆಗಳು',
      answer: 'ಚರ್ಮದ ಅಲರ್ಜಿ, ತುರಿಕೆ ಅಥವಾ ಸೋಂಕಿಗೆ ಚರ್ಮರೋಗ ತಜ್ಞರನ್ನು ಸಂಪರ್ಕಿಸಿ.',
      details: [
        'ಪೀಡಿತ ಜಾಗವನ್ನು ಸ್ವಚ್ಛವಾಗಿಡಿ, ಪರಚಿಕೊಳ್ಳಬೇಡಿ, ಹತ್ತಿ ಬಟ್ಟೆ ಧರಿಸಿ.'
      ],
      nextSteps: 'ಡರ್ಮಟಾಲಜಿಸ್ಟ್ (Dermatologist) ರನ್ನು ಸಂಪರ್ಕಿಸಿ.',
      specialtyReason: 'ಚರ್ಮದ ಸಮಸ್ಯೆಗಳಿಗೆ ಚರ್ಮರೋಗ ತಜ್ಞರು ಶಿಫಾರಸು ಮಾಡಲಾಗಿದೆ.'
    },
    bp: {
      title: 'ರಕ್ತದೊತ್ತಡ (Blood Pressure) ಅರ್ಥಮಾಡಿಕೊಳ್ಳುವುದು',
      answer: 'ಸಾಮಾನ್ಯ ರಕ್ತದೊತ್ತಡವು ಸುಮಾರು 120/80 mmHg ಆಗಿದೆ. 130/80 ಕ್ಕಿಂತ ಹೆಚ್ಚು ಇರುವುದು ಅಧಿಕ ರಕ್ತದೊತ್ತಡವಾಗಿದೆ.',
      details: [
        'ಉಪ್ಪು ಸೇವನೆ ಕಡಿಮೆ ಮಾಡಿ, ಪ್ರತಿದಿನ 30 ನಿಮಿಷ ವ್ಯಾಯಾಮ ಮಾಡಿ, ಒತ್ತಡ ಕಡಿಮೆ ಮಾಡಿ.'
      ],
      nextSteps: 'ಕಾರ್ಡಿಯಾಲಜಿಸ್ಟ್ ಅಥವಾ ಜನರಲ್ ಫಿಸಿಶಿಯನ್ ರನ್ನು ಸಂಪರ್ಕಿಸಿ.',
      specialtyReason: 'ಹೃದಯ ಮತ್ತು ರಕ್ತದೊತ್ತಡಕ್ಕಾಗಿ ಹೃದ್ರೋಗ ತಜ್ಞರು ಶಿಫಾರಸು ಮಾಡಲಾಗಿದೆ.'
    },
    booking: {
      title: 'ವೈದ್ಯರೊಂದಿಗೆ ಅಪಾಯಿಂಟ್ಮೆಂಟ್ ಬುಕ್ ಮಾಡುವುದು',
      answer: 'ಹೌದು! ಮೆಡಿಕನೆಕ್ಟ್ ಪೋರ್ಟಲ್‌ನಲ್ಲಿ ನೀವು ನೋಂದಾಯಿತ ವೈದ್ಯರೊಂದಿಗೆ ನೇರವಾಗಿ ಅಪಾಯಿಂಟ್ಮೆಂಟ್ ಬುಕ್ ಮಾಡಬಹುದು.',
      details: [
        'ಕೆಳಗಿನ ಡಾಕ್ಟರ್ ಕಾರ್ಡ್‌ನಲ್ಲಿರುವ **ಅಪಾಯಿಂಟ್ಮೆಂಟ್ ಬುಕ್ ಮಾಡಿ** ಬಟನ್ ಕ್ಲಿಕ್ ಮಾಡಿ.',
        'ಹೆಚ್ಚಿನ ವೈದ್ಯರಿಗಾಗಿ **ವೈದ್ಯರನ್ನು ಹುಡುಕಿ** ಮೆನುಗೆ ಹೋಗಿ.'
      ],
      nextSteps: 'ಡಾಕ್ಟರ್ ಕಾರ್ಡ್‌ನಲ್ಲಿರುವ ಬಟನ್ ಕ್ಲಿಕ್ ಮಾಡಿ.',
      specialtyReason: 'ಜನರಲ್ ಫಿಸಿಶಿಯನ್ ಅಥವಾ ಯಾವುದೇ ತಜ್ಞರೊಂದಿಗೆ ಬುಕ್ ಮಾಡಬಹುದು.'
    },
    gp_vs_cardio: {
      title: 'ಜನರಲ್ ಫಿಸಿಶಿಯನ್ ಮತ್ತು ಹೃದ್ರೋಗ ತಜ್ಞರ ನಡುವಿನ ವ್ಯತ್ಯಾಸ',
      answer: 'ಜನರಲ್ ಫಿಸಿಶಿಯನ್ ಸಾಮಾನ್ಯ ಆರೋಗ್ಯ ಸಮಸ್ಯೆಗಳ ವೈದ್ಯರು; ಕಾರ್ಡಿಯಾಲಜಿಸ್ಟ್ ಹೃದಯದ ಕಾಯಿಲೆಗಳ ತಜ್ಞ ವೈದ್ಯರು.',
      details: [
        'ಜ್ವರ, ಶೀತ, ಕೆಮ್ಮಿಗೆ ಜನರಲ್ ಫಿಸಿಶಿಯನ್; ಹೃದಯದ ತೊಂದರೆ ಮತ್ತು ಅಧಿಕ ರಕ್ತದೊತ್ತಡಕ್ಕೆ ಕಾರ್ಡಿಯಾಲಜಿಸ್ಟ್.'
      ],
      nextSteps: 'ಮೊದಲು ಜನರಲ್ ಫಿಸಿಶಿಯನ್ ರನ್ನು ಸಂಪರ್ಕಿಸಿ.',
      specialtyReason: 'ಪ್ರಾಥಮಿಕ ತಪಾಸಣೆಗೆ ಜನರಲ್ ಫಿಸಿಶಿಯನ್ ಶಿಫಾರಸು ಮಾಡಲಾಗಿದೆ.'
    },
    general: {
      title: 'ಸಾಮಾನ್ಯ ಆರೋಗ್ಯ ಮಾರ್ಗದರ್ಶನ',
      answer: 'ಹೆಚ್ಚಿನ ಮಾಹಿತಿಗಾಗಿ ನಿಮ್ಮ ರೋಗಲಕ್ಷಣಗಳನ್ನು ವಿವರವಾಗಿ ತಿಳಿಸಿ.',
      details: [
        'ಸಮತೋಲಿತ ಆಹಾರ, ನಿಯಮಿತ ವ್ಯಾಯಾಮ, ಸಾಕಷ್ಟು ನಿದ್ರೆ ಮತ್ತು ನೀರು ಕುಡಿಯುವುದು ಮುಖ್ಯ.'
      ],
      nextSteps: 'ವೈದ್ಯರನ್ನು ಹುಡುಕಿ ಮೆನುವನ್ನು ವೀಕ್ಷಿಸಿ.',
      specialtyReason: 'ಜನರಲ್ ಫಿಸಿಶಿಯನ್ ಶಿಫಾರಸು ಮಾಡಲಾಗಿದೆ.'
    }
  }
};

const localizeResponse = (result, targetLanguage) => {
  if (!targetLanguage || targetLanguage === 'English') return result;
  const langDict = LOCAL_TRANSLATIONS[targetLanguage];
  if (!langDict) return result;

  let topic = 'general';
  if (result.isEmergency) {
    topic = 'emergency';
  } else if (result.title?.toLowerCase().includes('headache') || result.title?.toLowerCase().includes('fever')) {
    topic = 'headache';
  } else if (result.title?.toLowerCase().includes('skin') || result.title?.toLowerCase().includes('rash')) {
    topic = 'skin';
  } else if (result.title?.toLowerCase().includes('blood pressure') || result.title?.toLowerCase().includes('hypertension')) {
    topic = 'bp';
  } else if (result.title?.toLowerCase().includes('book') || result.title?.toLowerCase().includes('appointment')) {
    topic = 'booking';
  } else if (result.title?.toLowerCase().includes('cardiologist') || result.title?.toLowerCase().includes('physician')) {
    topic = 'gp_vs_cardio';
  }

  const translated = langDict[topic] || langDict.general;
  return {
    ...result,
    title: translated.title || result.title,
    answer: translated.answer || result.answer,
    details: translated.details || result.details,
    nextSteps: translated.nextSteps || result.nextSteps,
    specialtyReason: translated.specialtyReason || result.specialtyReason
  };
};

// --- Generate intelligent local response (no API key fallback) ---
const generateIntelligentResponse = (symptoms, query, conversationHistory = [], targetLanguage = 'English') => {
  const combined = `${symptoms || ''} ${query || ''}`;

  // Check for emergency first
  const emergency = detectEmergency(combined);
  if (emergency) {
    const rawResult = {
      isEmergency: true,
      title: '🚨 EMERGENCY – Seek Immediate Medical Help',
      answer: 'Based on what you\'ve described, this could be a medical emergency that requires immediate professional attention. Please do not delay seeking help.',
      details: [
        '**Call Emergency Services NOW:** Dial **112** (National Emergency) or **108** (Ambulance) immediately.',
        '**Do not drive yourself** to the hospital if possible. Have someone else drive or wait for the ambulance.',
        '**Stay calm** and try to remain in a comfortable position.',
        '**If with someone else,** inform them of your symptoms so they can relay information to emergency responders.'
      ],
      nextSteps: 'This is not something to manage at home. Immediate emergency medical care is the priority.',
      specialty: emergency.specialty,
      specialtyReason: 'Emergency symptoms detected — prioritizing immediate medical care over routine appointment.'
    };
    return localizeResponse(rawResult, targetLanguage);
  }

  // Find knowledge base match
  const knowledge = findKnowledgeMatch(combined);
  const specialtyMatches = recommendSpecialty(combined);

  if (knowledge) {
    const result = {
      isEmergency: false,
      title: knowledge.title,
      answer: knowledge.answer,
      details: knowledge.details,
      nextSteps: knowledge.nextSteps
    };

    if (specialtyMatches && specialtyMatches.length > 0) {
      result.specialty = specialtyMatches[0].specialty;
      result.specialtyReason = specialtyMatches[0].reason;
    } else if (knowledge.specialty) {
      result.specialty = knowledge.specialty;
      result.specialtyReason = `Based on your symptoms, a ${knowledge.specialty} specialist is recommended.`;
    }

    return localizeResponse(result, targetLanguage);
  }

  // If we have specialty match but no specific knowledge entry
  if (specialtyMatches && specialtyMatches.length > 0) {
    const primary = specialtyMatches[0];
    const result = {
      isEmergency: false,
      title: 'Health Guidance',
      answer: `Based on what you've described, here is some general guidance. For a more specific assessment, a ${primary.specialty} specialist would be most appropriate.`,
      details: [
        '**What You Can Do Now:** Note down all your symptoms, their duration, and any factors that make them better or worse.',
        '**Stay Hydrated:** Drink adequate water and rest well.',
        '**Monitor Symptoms:** If symptoms worsen or new concerning symptoms develop, seek medical attention promptly.',
        '**Avoid Self-Medication:** Don\'t take prescription medicines without consulting a doctor.'
      ],
      nextSteps: `We recommend consulting a ${primary.specialty} specialist. You can find available doctors using the "Find a Doctor" feature.`,
      specialty: primary.specialty,
      specialtyReason: primary.reason
    };
    return localizeResponse(result, targetLanguage);
  }

  // Truly general / unrecognized query
  const result = {
    isEmergency: false,
    title: 'General Health Guidance',
    answer: `Thank you for your health question. While I can provide general health information, I want to make sure you get the most relevant guidance.`,
    details: [
      '**Could you provide more details?** Specific symptoms, their duration, and any changes you\'ve noticed can help me give you more targeted information.',
      '**General Wellness:** Maintain a balanced diet, regular exercise, adequate sleep (7-9 hours), and stay hydrated.',
      '**Preventive Health:** Regular health check-ups and age-appropriate screenings are important for early detection.',
      '**When to See a Doctor:** Any persistent, worsening, or concerning symptoms should be evaluated by a healthcare professional.'
    ],
    nextSteps: 'Try describing your specific symptoms or health concern for more tailored guidance, or browse our doctors under "Find a Doctor".',
    specialty: 'General Medicine',
    specialtyReason: 'For general health inquiries, a General Physician is a good starting point.'
  };
  return localizeResponse(result, targetLanguage);
};

// --- Call Gemini API ---
const callGeminiAPI = async (symptoms, query, conversationHistory = [], targetLanguage = 'English') => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const systemPrompt = `You are MediConnect AI, an intelligent healthcare assistant integrated into a hospital management portal. Your role:

CRITICAL LANGUAGE REQUIREMENT:
The user's preferred language is: ${targetLanguage}.
You MUST formulate your ENTIRE response (title, answer, every item in details, nextSteps, specialtyReason, followUpQuestion) strictly in ${targetLanguage}.
- If ${targetLanguage} is 'Tamil', write fluently and naturally in Tamil (தமிழ்).
- If ${targetLanguage} is 'Hindi', write fluently and naturally in Hindi (हिन्दी).
- If ${targetLanguage} is 'Telugu', write fluently and naturally in Telugu (తెలుగు).
- If ${targetLanguage} is 'Malayalam', write fluently and naturally in Malayalam (മലയാളം).
- If ${targetLanguage} is 'Kannada', write fluently and naturally in Kannada (ಕನ್ನಡ).
- If ${targetLanguage} is 'English', write in English.
Even if the user asks their question in English, if their preferred language is ${targetLanguage}, formulate the answer in ${targetLanguage}.
EXCEPTION: If the user explicitly asks for a different language in their message (e.g. "answer in Hindi"), prioritize that explicit user instruction.

RULES:
1. Provide educational health information — NEVER confirm a diagnosis or prescribe specific medicines/dosages.
2. Always recommend consulting a qualified doctor for proper diagnosis.
3. For emergency symptoms (chest pain, severe breathing difficulty, stroke signs, severe allergic reactions, unconsciousness), IMMEDIATELY prioritize emergency care (India: dial 112 or 108).
4. Never falsely reassure if symptoms could be serious.
5. Ask relevant follow-up questions when information is insufficient.
6. Give structured responses with clear headings and bullet points.
7. Keep the "specialty" field value in standard English (e.g. "General Medicine", "Cardiology", "Dermatology", "Neurology", "Orthopedics") for database matching, but write the "specialtyReason" in ${targetLanguage}.

RESPONSE FORMAT (return valid JSON):
{
  "isEmergency": boolean,
  "title": "Response title in ${targetLanguage}",
  "answer": "Direct answer to the question in ${targetLanguage}",
  "details": ["**Point 1:** explanation in ${targetLanguage}", "**Point 2:** explanation in ${targetLanguage}"],
  "nextSteps": "Clear actionable next steps in ${targetLanguage}",
  "specialty": "Standard specialty in English",
  "specialtyReason": "Why this specialty is recommended in ${targetLanguage}",
  "followUpQuestion": "Optional clarifying question in ${targetLanguage} or null"
}`;

  const messages = [{ role: 'user', parts: [{ text: systemPrompt }] }];

  // Add conversation history for context
  if (conversationHistory.length > 0) {
    for (const msg of conversationHistory.slice(-6)) {
      messages.push({
        role: 'user',
        parts: [{ text: `Previous Q: ${msg.symptoms ? `[Symptoms: ${msg.symptoms}] ` : ''}${msg.query}` }]
      });
      messages.push({
        role: 'model',
        parts: [{ text: msg.response }]
      });
    }
  }

  const currentMessage = `${symptoms ? `Symptoms reported: ${symptoms}. ` : ''}User question: ${query || 'Please analyze the symptoms above.'} (Respond in ${targetLanguage})`;
  messages.push({ role: 'user', parts: [{ text: currentMessage }] });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: messages,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1200,
            responseMimeType: 'application/json'
          }
        })
      }
    );
    const data = await response.json();

    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const text = data.candidates[0].content.parts[0].text;
      try {
        return JSON.parse(text);
      } catch {
        return {
          isEmergency: false,
          title: 'AI Health Guidance',
          answer: text,
          details: [],
          nextSteps: 'Consult a qualified healthcare professional.'
        };
      }
    }
  } catch (e) {
    console.warn('Gemini API error, falling back to local knowledge:', e.message);
  }
  return null;
};

// --- Call OpenAI API ---
const callOpenAIAPI = async (symptoms, query, conversationHistory = [], targetLanguage = 'English') => {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) return null;

  const systemPrompt = `You are MediConnect AI, an intelligent healthcare assistant. Your role:
CRITICAL LANGUAGE: Formulate your entire response strictly in ${targetLanguage} (even if user asks in English).
EXCEPTION: If user explicitly asks for another language in their message, respect that.
1. Provide educational health information — NEVER diagnose or prescribe medicines.
2. Always recommend consulting a qualified doctor.
3. Flag emergencies (chest pain, severe breathing difficulty, stroke signs) and prioritize emergency care (India: 112/108).
4. Keep the "specialty" field in English for database lookup, but "specialtyReason" in ${targetLanguage}.
5. Give structured, clear responses.

Return valid JSON with this structure:
{"isEmergency": boolean, "title": "string in ${targetLanguage}", "answer": "string in ${targetLanguage}", "details": ["string in ${targetLanguage}"], "nextSteps": "string in ${targetLanguage}", "specialty": "string in English or null", "specialtyReason": "string in ${targetLanguage} or null", "followUpQuestion": "string or null"}`;

  const messages = [{ role: 'system', content: systemPrompt }];

  if (conversationHistory.length > 0) {
    for (const msg of conversationHistory.slice(-6)) {
      messages.push({ role: 'user', content: `${msg.symptoms ? `[Symptoms: ${msg.symptoms}] ` : ''}${msg.query}` });
      messages.push({ role: 'assistant', content: msg.response });
    }
  }

  messages.push({
    role: 'user',
    content: `${symptoms ? `Symptoms: ${symptoms}. ` : ''}Question: ${query || 'Analyze these symptoms.'} (Respond in ${targetLanguage})`
  });

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages,
        response_format: { type: 'json_object' }
      })
    });
    const data = await response.json();
    if (data.choices && data.choices[0]) {
      try {
        return JSON.parse(data.choices[0].message.content);
      } catch {
        return {
          isEmergency: false,
          title: 'AI Health Guidance',
          answer: data.choices[0].message.content,
          details: [],
          nextSteps: 'Consult a qualified healthcare professional.'
        };
      }
    }
  } catch (e) {
    console.warn('OpenAI API error, falling back to local knowledge:', e.message);
  }
  return null;
};

// --- Language update endpoint ---
app.put('/api/auth/language', auth(), wrap(async (req, res) => {
  const { language } = req.body;
  if (language) {
    await q('UPDATE users SET language = ? WHERE id = ?', [language, req.user.id]);
  }
  res.json({ ok: true, language });
}));

// --- Main AI Chat Endpoint (Conversational & Multilingual) ---
app.post('/api/ai/chat', auth('PATIENT', 'HEALTH_WORKER'), wrap(async (req, res) => {
  const { symptoms, query, language } = req.body;
  if (!query && !symptoms) {
    return res.status(400).json({ error: 'Please enter your symptoms or health question.' });
  }

  // Determine target response language:
  // 1. Explicit request in message (e.g. "answer in Hindi", "தமிழில் பதில் கூறு")
  // 2. Language passed in request body from frontend selector
  // 3. User's saved language preference in database
  // 4. Default to English
  const explicitLang = detectLanguageOverride(query);
  const targetLanguage = explicitLang || language || req.user.language || 'English';

  // Fetch recent conversation history for context
  const history = await q(
    'SELECT symptoms, query, response FROM ai_interactions WHERE user_id = ? ORDER BY id DESC LIMIT 6',
    [req.user.id]
  );
  const conversationHistory = history.reverse();

  let aiResult = null;
  let aiSource = 'local';

  // Try Gemini API first
  if (process.env.GEMINI_API_KEY) {
    aiResult = await callGeminiAPI(symptoms, query, conversationHistory, targetLanguage);
    if (aiResult) aiSource = 'gemini';
  }

  // Try OpenAI if Gemini didn't work
  if (!aiResult && process.env.AI_API_KEY) {
    aiResult = await callOpenAIAPI(symptoms, query, conversationHistory, targetLanguage);
    if (aiResult) aiSource = 'openai';
  }

  // Fall back to local intelligent knowledge base
  if (!aiResult) {
    aiResult = generateIntelligentResponse(symptoms, query, conversationHistory, targetLanguage);
    aiSource = 'local';
  }

  // Find matching doctors from database
  let recommendedDoctors = [];
  if (aiResult.specialty) {
    // Search with flexible matching
    const specSearch = `%${aiResult.specialty}%`;
    recommendedDoctors = await q(
      `SELECT d.id, u.name, d.specialization, d.experience, d.qualification,
              d.start_time, d.end_time, d.available_days, d.consultation_fee, d.bio
       FROM doctors d
       JOIN users u ON u.id = d.user_id
       WHERE d.specialization LIKE ?
       ORDER BY d.experience DESC
       LIMIT 5`,
      [specSearch]
    );

    // If no exact match, try broader search
    if (recommendedDoctors.length === 0) {
      // Try mapping common specialty names
      const specMappings = {
        'General Medicine': ['General%', '%Medicine%', '%Physician%'],
        'Cardiology': ['Cardio%', '%Heart%'],
        'Dermatology': ['Dermat%', '%Skin%'],
        'Orthopedics': ['Ortho%', '%Bone%'],
        'Neurology': ['Neuro%', '%Brain%'],
        'Psychiatry': ['Psych%', '%Mental%'],
        'Gastroenterology': ['Gastro%', '%Digestive%'],
        'ENT': ['ENT%', '%Otolaryn%', '%Ear%'],
        'Ophthalmology': ['Ophthal%', '%Eye%'],
        'Dentistry': ['Dent%'],
        'Pulmonology': ['Pulmo%', '%Lung%', '%Respiratory%'],
        'Endocrinology': ['Endocrin%', '%Diabet%', '%Thyroid%'],
        'Urology': ['Urol%', '%Kidney%'],
        'Gynecology': ['Gynec%', '%Obstet%'],
        'Pediatrics': ['Pediat%', '%Child%'],
        'Oncology': ['Oncol%', '%Cancer%']
      };

      const broadPatterns = specMappings[aiResult.specialty] || [`%${aiResult.specialty}%`];
      for (const pattern of broadPatterns) {
        if (recommendedDoctors.length > 0) break;
        recommendedDoctors = await q(
          `SELECT d.id, u.name, d.specialization, d.experience, d.qualification,
                  d.start_time, d.end_time, d.available_days, d.consultation_fee, d.bio
           FROM doctors d
           JOIN users u ON u.id = d.user_id
           WHERE d.specialization LIKE ?
           ORDER BY d.experience DESC
           LIMIT 5`,
          [pattern]
        );
      }
    }
  }

  // Store the interaction
  const responseText = JSON.stringify(aiResult);
  await q(
    'INSERT INTO ai_interactions (user_id, symptoms, query, response) VALUES (?, ?, ?, ?)',
    [req.user.id, symptoms || null, query || 'Symptom analysis', responseText]
  );

  res.json({
    ...aiResult,
    doctors: recommendedDoctors,
    source: aiSource,
    noApiKey: !process.env.GEMINI_API_KEY && !process.env.AI_API_KEY
  });
}));

// --- Keep legacy endpoint working with multilingual support ---
app.post('/api/ai/query', auth('PATIENT', 'HEALTH_WORKER'), wrap(async (req, res) => {
  const { symptoms, query, language } = req.body;
  if (!query && !symptoms) {
    return res.status(400).json({ error: 'Please enter symptoms or describe your query.' });
  }

  const explicitLang = detectLanguageOverride(query);
  const targetLanguage = explicitLang || language || req.user.language || 'English';

  let aiResponse = null;

  if (process.env.GEMINI_API_KEY) {
    const result = await callGeminiAPI(symptoms, query, [], targetLanguage);
    if (result) aiResponse = result.answer + (result.details ? '\n\n' + result.details.join('\n') : '') + (result.nextSteps ? '\n\n📌 ' + result.nextSteps : '');
  }

  if (!aiResponse && process.env.AI_API_KEY) {
    const result = await callOpenAIAPI(symptoms, query, [], targetLanguage);
    if (result) aiResponse = result.answer + (result.details ? '\n\n' + result.details.join('\n') : '') + (result.nextSteps ? '\n\n📌 ' + result.nextSteps : '');
  }

  if (!aiResponse) {
    const result = generateIntelligentResponse(symptoms, query, [], targetLanguage);
    aiResponse = result.answer + '\n\n' + result.details.join('\n') + '\n\n📌 ' + result.nextSteps;
  }

  aiResponse += '\n\n⚠️ Disclaimer: MediConnect AI guidance is for educational and informational purposes only. It is NOT a professional medical diagnosis or prescription. Always consult a qualified physician.';

  await q(
    'INSERT INTO ai_interactions (user_id, symptoms, query, response) VALUES (?, ?, ?, ?)',
    [req.user.id, symptoms || null, query || 'Symptom check', aiResponse]
  );

  res.json({ response: aiResponse, language: targetLanguage });
}));

app.get('/api/ai/history', auth('PATIENT', 'HEALTH_WORKER'), wrap(async (req, res) => {
  const history = await q(
    'SELECT * FROM ai_interactions WHERE user_id = ? ORDER BY id DESC LIMIT 20',
    [req.user.id]
  );
  res.json(history);
}));


// ==========================================
// 6. PRESCRIPTIONS & MEDICINE TRACKING APIS
// ==========================================

// Create Prescription (Strictly DOCTORS only)
app.post('/api/prescriptions', auth('DOCTOR'), wrap(async (req, res) => {
  const { appointment_id, patient_id, diagnosis, notes, items } = req.body;

  if (!patient_id || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Patient and at least one prescribed medicine item are required.' });
  }

  const docRows = await q('SELECT id FROM doctors WHERE user_id = ?', [req.user.id]);
  if (docRows.length === 0) return res.status(404).json({ error: 'Doctor record not found.' });
  const doctorId = docRows[0].id;

  // Insert master prescription
  const pResult = await q(
    'INSERT INTO prescriptions (appointment_id, patient_id, doctor_id, diagnosis, notes) VALUES (?, ?, ?, ?, ?)',
    [appointment_id || null, patient_id, doctorId, diagnosis || null, notes || null]
  );
  const prescriptionId = pResult.insertId;

  // Insert items and create reminders
  for (const item of items) {
    const days = parseInt(item.days, 10) || 5;
    const freq = parseInt(item.frequency, 10) || 1;

    const itResult = await q(
      `INSERT INTO prescription_items
       (prescription_id, medicine_id, dosage, frequency, days, instructions, start_date, end_date)
       VALUES (?, ?, ?, ?, ?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL ? DAY))`,
      [prescriptionId, item.medicine_id, item.dosage || '1 dose', freq, days, item.instructions || 'As advised', days]
    );

    // Schedule dose reminders based on frequency
    const standardDoseTimes = ['09:00:00', '21:00:00', '14:00:00', '23:00:00'].slice(0, Math.min(freq, 4));
    for (const remindTime of standardDoseTimes) {
      await q(
        'INSERT INTO medicine_reminders (patient_id, item_id, remind_time, status) VALUES (?, ?, ?, "Active")',
        [patient_id, itResult.insertId, remindTime]
      );
    }
  }

  // Notify patient
  await q('INSERT INTO notifications (user_id, message) VALUES (?, ?)',
    [patient_id, 'A new prescription has been issued by your doctor. View it under My Prescriptions.']);

  res.status(201).json({ id: prescriptionId, message: 'Prescription issued and reminders created successfully!' });
}));

// Get Prescriptions (Role-filtered)
app.get('/api/prescriptions', auth(), wrap(async (req, res) => {
  const { id: userId, role } = req.user;

  let sql = `
    SELECT p.id, p.appointment_id, p.patient_id, p.doctor_id, p.diagnosis, p.notes, p.created_at,
           pu.name AS patient_name, pu.gender AS patient_gender, pu.dob AS patient_dob,
           du.name AS doctor_name, d.specialization AS doctor_specialization
    FROM prescriptions p
    JOIN users pu ON pu.id = p.patient_id
    JOIN doctors d ON d.id = p.doctor_id
    JOIN users du ON du.id = d.user_id
  `;
  const params = [];

  if (role === 'PATIENT') {
    sql += ' WHERE p.patient_id = ? ORDER BY p.id DESC';
    params.push(userId);
  } else if (role === 'DOCTOR') {
    sql += ' WHERE d.user_id = ? ORDER BY p.id DESC';
    params.push(userId);
  } else if (role === 'HEALTH_WORKER') {
    sql += `
      JOIN health_worker_patients hwp ON hwp.patient_id = p.patient_id
      JOIN health_workers hw ON hw.id = hwp.health_worker_id
      WHERE hw.user_id = ?
      ORDER BY p.id DESC
    `;
    params.push(userId);
  } else {
    sql += ' ORDER BY p.id DESC';
  }

  const prescriptions = await q(sql, params);

  // Fetch items for each prescription
  for (const rx of prescriptions) {
    rx.items = await q(
      `SELECT pi.*, m.name AS medicine_name, m.category, m.dosage_form,
              IF(pi.end_date >= CURDATE(), 'Active', 'Completed') AS status
       FROM prescription_items pi
       JOIN medicines m ON m.id = pi.medicine_id
       WHERE pi.prescription_id = ?`,
      [rx.id]
    );
  }

  res.json(prescriptions);
}));

// Medicines catalog
app.get('/api/medicines', auth(), wrap(async (req, res) => {
  const search = req.query.search ? `%${req.query.search.trim()}%` : '%';
  const medicines = await q(
    'SELECT * FROM medicines WHERE name LIKE ? ORDER BY name ASC',
    [search]
  );
  res.json(medicines);
}));

// Medicine Reminders & Dose Logs (PATIENT)
app.get('/api/reminders', auth('PATIENT'), wrap(async (req, res) => {
  const today = new Date().toISOString().split('T')[0];

  const reminders = await q(
    `SELECT r.id, r.remind_time, r.status,
            pi.dosage, pi.instructions, pi.start_date, pi.end_date,
            m.name AS medicine_name, m.dosage_form,
            du.name AS doctor_name,
            IF(dl.id IS NOT NULL AND dl.status = 'Taken', 'Taken', 'Pending') AS today_status,
            IF(dl.id IS NOT NULL AND dl.status = 'Taken', 'Taken', IF(CURTIME() > r.remind_time, 'Overdue', 'Pending')) AS calculated_status,
            dl.taken_at
     FROM medicine_reminders r
     JOIN prescription_items pi ON pi.id = r.item_id
     JOIN medicines m ON m.id = pi.medicine_id
     JOIN prescriptions p ON p.id = pi.prescription_id
     JOIN doctors d ON d.id = p.doctor_id
     JOIN users du ON du.id = d.user_id
     LEFT JOIN medicine_dose_logs dl ON dl.reminder_id = r.id AND dl.dose_date = ?
     WHERE r.patient_id = ?
     ORDER BY r.remind_time ASC`,
    [today, req.user.id]
  );

  res.json(reminders);
}));

// Patient logs scheduled dose as taken
app.post('/api/reminders/:id/take', auth('PATIENT'), wrap(async (req, res) => {
  const reminderId = req.params.id;
  const today = new Date().toISOString().split('T')[0];

  const [rem] = await q(
    `SELECT r.*, m.name AS medicine_name, pi.dosage 
     FROM medicine_reminders r 
     JOIN prescription_items pi ON pi.id = r.item_id 
     JOIN medicines m ON m.id = pi.medicine_id 
     WHERE r.id = ? AND r.patient_id = ?`,
    [reminderId, req.user.id]
  );
  if (!rem) return res.status(404).json({ error: 'Reminder not found or access denied.' });

  // Record dose in daily log
  await q(
    `INSERT INTO medicine_dose_logs (reminder_id, patient_id, dose_date, status, taken_at)
     VALUES (?, ?, ?, 'Taken', CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE status = 'Taken', taken_at = CURRENT_TIMESTAMP`,
    [reminderId, req.user.id, today]
  );

  const [log] = await q(
    'SELECT taken_at, status FROM medicine_dose_logs WHERE reminder_id = ? AND dose_date = ?',
    [reminderId, today]
  );

  res.json({
    ok: true,
    message: `${rem.medicine_name} (${rem.dosage}) marked as taken!`,
    taken_at: log?.taken_at || new Date().toISOString(),
    reminder_id: Number(reminderId)
  });
}));

// Toggle reminder active/completed
app.put('/api/reminders/:id', auth('PATIENT'), wrap(async (req, res) => {
  const { status } = req.body;
  await q('UPDATE medicine_reminders SET status = ? WHERE id = ? AND patient_id = ?', [status, req.params.id, req.user.id]);
  res.json({ ok: true });
}));

// ==========================================
// 7. HEALTH WORKER DEDICATED APIS & PATIENT MANAGEMENT
// ==========================================

// Patient-wise prescription retrieval (DOCTOR, HEALTH_WORKER, PATIENT, ADMIN)
app.get('/api/patients/:patientId/prescriptions', auth(), wrap(async (req, res) => {
  const patientId = req.params.patientId;
  const { id: userId, role } = req.user;

  // Authorization check
  if (role === 'PATIENT' && parseInt(patientId, 10) !== userId) {
    return res.status(403).json({ error: 'Access denied: You can only view your own prescriptions.' });
  }

  const prescriptions = await q(
    `SELECT p.*, du.name AS doctor_name, d.specialization AS doctor_specialization, d.qualification AS doctor_qualification
     FROM prescriptions p
     JOIN doctors d ON d.id = p.doctor_id
     JOIN users du ON du.id = d.user_id
     WHERE p.patient_id = ?
     ORDER BY p.created_at DESC`,
    [patientId]
  );

  for (const rx of prescriptions) {
    rx.items = await q(
      `SELECT pi.*, m.name AS medicine_name, m.dosage_form, m.category
       FROM prescription_items pi
       JOIN medicines m ON m.id = pi.medicine_id
       WHERE pi.prescription_id = ?`,
      [rx.id]
    );
  }

  res.json(prescriptions);
}));

// Health Worker Profile Details
app.get('/api/health-worker/profile', auth('HEALTH_WORKER', 'ADMIN'), wrap(async (req, res) => {
  const [hw] = await q(
    `SELECT u.id, u.name, u.email, u.phone, u.gender, u.dob, u.address, u.language, u.profile_photo,
            hw.id AS health_worker_id, hw.assigned_area, hw.health_centre, hw.location, hw.employee_id, hw.qualification
     FROM health_workers hw
     JOIN users u ON u.id = hw.user_id
     WHERE u.id = ?`,
    [req.user.id]
  );
  if (!hw) return res.status(404).json({ error: 'Health Worker profile not found.' });
  res.json(hw);
}));

// Health Worker Profile Update
app.put('/api/health-worker/profile', auth('HEALTH_WORKER', 'ADMIN'), wrap(async (req, res) => {
  const { name, phone, address, language, assigned_area, health_centre, location, qualification, profile_photo } = req.body;

  await q(
    `UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone), address = COALESCE(?, address),
     language = COALESCE(?, language), profile_photo = COALESCE(?, profile_photo) WHERE id = ?`,
    [name || null, phone || null, address || null, language || null, profile_photo || null, req.user.id]
  );

  await q(
    `UPDATE health_workers SET assigned_area = COALESCE(?, assigned_area), health_centre = COALESCE(?, health_centre),
     location = COALESCE(?, location), qualification = COALESCE(?, qualification) WHERE user_id = ?`,
    [assigned_area || null, health_centre || null, location || null, qualification || null, req.user.id]
  );

  res.json({ ok: true, message: 'Health worker profile updated successfully!' });
}));

// Health Worker Dashboard Stats (Calculated strictly from database records)
app.get('/api/health-worker/dashboard', auth('HEALTH_WORKER', 'ADMIN'), wrap(async (req, res) => {
  const hwRows = await q('SELECT id FROM health_workers WHERE user_id = ?', [req.user.id]);
  if (hwRows.length === 0) return res.status(404).json({ error: 'Health Worker record not found.' });
  const hwId = hwRows[0].id;

  const [patientsCount] = await q('SELECT COUNT(DISTINCT patient_id) c FROM health_worker_patients WHERE health_worker_id = ?', [hwId]);
  const [visitsCount] = await q('SELECT COUNT(*) c FROM home_visits WHERE health_worker_id = ?', [hwId]);
  const [followupsCount] = await q('SELECT COUNT(*) c FROM patient_followups WHERE health_worker_id = ?', [hwId]);

  // Appointments today
  const [todayAptsCount] = await q(
    `SELECT COUNT(*) c FROM appointments a
     WHERE a.date = CURDATE() AND (
       a.booked_by_health_worker_id = ? OR
       a.patient_id IN (SELECT patient_id FROM health_worker_patients WHERE health_worker_id = ?)
     )`,
    [hwId, hwId]
  );

  // Upcoming consultations
  const [upcomingConsultsCount] = await q(
    `SELECT COUNT(*) c FROM appointments a
     WHERE a.date >= CURDATE() AND a.status IN ('Pending', 'Confirmed') AND (
       a.booked_by_health_worker_id = ? OR
       a.patient_id IN (SELECT patient_id FROM health_worker_patients WHERE health_worker_id = ?)
     )`,
    [hwId, hwId]
  );

  // Completed consultations
  const [completedConsultsCount] = await q(
    `SELECT COUNT(*) c FROM appointments a
     WHERE (a.status = 'Completed' OR a.meeting_status = 'Completed') AND (
       a.booked_by_health_worker_id = ? OR
       a.patient_id IN (SELECT patient_id FROM health_worker_patients WHERE health_worker_id = ?)
     )`,
    [hwId, hwId]
  );

  // Today's appointments list
  const todayAppointments = await q(
    `SELECT a.*, pu.name AS patient_name, pu.phone AS patient_phone, du.name AS doctor_name, d.specialization
     FROM appointments a
     JOIN users pu ON pu.id = a.patient_id
     JOIN doctors d ON d.id = a.doctor_id
     JOIN users du ON du.id = d.user_id
     WHERE a.date = CURDATE() AND (
       a.booked_by_health_worker_id = ? OR
       a.patient_id IN (SELECT patient_id FROM health_worker_patients WHERE health_worker_id = ?)
     )
     ORDER BY a.time ASC`,
    [hwId, hwId]
  );

  const recentVisits = await q(
    `SELECT hv.*, u.name AS patient_name, u.phone AS patient_phone
     FROM home_visits hv
     JOIN users u ON u.id = hv.patient_id
     WHERE hv.health_worker_id = ?
     ORDER BY hv.visit_date DESC
     LIMIT 5`,
    [hwId]
  );

  const upcomingFollowups = await q(
    `SELECT hv.id, hv.patient_id, hv.next_followup_date, hv.observations, u.name AS patient_name, u.phone AS patient_phone
     FROM home_visits hv
     JOIN users u ON u.id = hv.patient_id
     WHERE hv.health_worker_id = ? AND hv.next_followup_date >= CURDATE()
     ORDER BY hv.next_followup_date ASC
     LIMIT 5`,
    [hwId]
  );

  res.json({
    stats: {
      managedPatients: patientsCount.c,
      todayAppointments: todayAptsCount.c,
      upcomingConsultations: upcomingConsultsCount.c,
      completedConsultations: completedConsultsCount.c,
      totalHomeVisits: visitsCount.c,
      recordedFollowups: followupsCount.c
    },
    todayAppointments,
    recentVisits,
    upcomingFollowups
  });
}));

// Get all assigned patients for health worker
app.get('/api/health-worker/patients', auth('HEALTH_WORKER', 'ADMIN'), wrap(async (req, res) => {
  const hwRows = await q('SELECT id FROM health_workers WHERE user_id = ?', [req.user.id]);
  if (hwRows.length === 0) return res.status(404).json({ error: 'Health Worker not found.' });
  const hwId = hwRows[0].id;

  const search = req.query.search ? `%${req.query.search.trim()}%` : '%';

  const patients = await q(
    `SELECT u.id, u.name, u.email, u.phone, u.gender, u.dob, u.address, u.language,
            u.medical_history, u.allergies, u.current_medications, u.profile_photo,
            u.emergency_contact_name, u.emergency_contact_phone,
            hwp.assigned_at, hwp.notes AS assignment_notes,
            (SELECT MAX(visit_date) FROM home_visits WHERE patient_id = u.id AND health_worker_id = ?) AS last_visit_date,
            (SELECT COUNT(*) FROM home_visits WHERE patient_id = u.id AND health_worker_id = ?) AS total_visits
     FROM health_worker_patients hwp
     JOIN users u ON u.id = hwp.patient_id
     WHERE hwp.health_worker_id = ? AND (u.name LIKE ? OR u.phone LIKE ? OR CAST(u.id AS CHAR) LIKE ?)
     ORDER BY u.name ASC`,
    [hwId, hwId, hwId, search, search, search]
  );

  res.json(patients);
}));

// Health worker registers a new patient & assigns to self (Prevents duplicates)
app.post('/api/health-worker/patients', auth('HEALTH_WORKER', 'ADMIN'), wrap(async (req, res) => {
  const hwRows = await q('SELECT id FROM health_workers WHERE user_id = ?', [req.user.id]);
  if (hwRows.length === 0) return res.status(404).json({ error: 'Health worker record not found.' });
  const hwId = hwRows[0].id;

  const { name, email, phone, gender, dob, address, language, emergency_contact_name, emergency_contact_phone, notes, medical_history, allergies, current_medications } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Patient full name is required.' });
  }

  // Check duplicate by phone
  if (phone && phone.trim()) {
    const existingByPhone = await q('SELECT id, name FROM users WHERE phone = ?', [phone.trim()]);
    if (existingByPhone.length > 0) {
      const existingUser = existingByPhone[0];
      await q(
        'INSERT IGNORE INTO health_worker_patients (health_worker_id, patient_id, notes) VALUES (?, ?, ?)',
        [hwId, existingUser.id, notes || 'Assigned to Health Worker']
      );
      if (medical_history || allergies || current_medications || address) {
        await q(
          `UPDATE users SET medical_history = COALESCE(?, medical_history), allergies = COALESCE(?, allergies),
           current_medications = COALESCE(?, current_medications), address = COALESCE(?, address) WHERE id = ?`,
          [medical_history || null, allergies || null, current_medications || null, address || null, existingUser.id]
        );
      }
      return res.status(200).json({
        id: existingUser.id,
        isExisting: true,
        message: `Patient ${existingUser.name} (#${existingUser.id}) is already registered and is now linked to your managed patients list.`
      });
    }
  }

  // Auto-generate unique email if not provided
  let patientEmail = email ? email.trim().toLowerCase() : null;
  if (!patientEmail) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    patientEmail = `${slug || 'patient'}.${rand}@mediconnect.local`;
  }

  const existing = await q('SELECT id, name FROM users WHERE email = ?', [patientEmail]);
  if (existing.length > 0) {
    const existingUser = existing[0];
    await q(
      'INSERT IGNORE INTO health_worker_patients (health_worker_id, patient_id, notes) VALUES (?, ?, ?)',
      [hwId, existingUser.id, notes || 'Assigned to Health Worker']
    );
    return res.status(200).json({
      id: existingUser.id,
      isExisting: true,
      message: `Patient ${existingUser.name} (#${existingUser.id}) with this email is now linked to your managed patients list.`
    });
  }

  const defaultPassword = 'Password@123';
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  const uResult = await q(
    `INSERT INTO users (name, email, password_hash, phone, gender, dob, address, language, emergency_contact_name, emergency_contact_phone, medical_history, allergies, current_medications, role)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PATIENT')`,
    [
      name.trim(),
      patientEmail,
      passwordHash,
      phone || null,
      gender || 'Other',
      dob || null,
      address || null,
      language || 'English',
      emergency_contact_name || null,
      emergency_contact_phone || null,
      medical_history || null,
      allergies || null,
      current_medications || null
    ]
  );
  const newPatientId = uResult.insertId;

  // Link patient to health worker
  await q(
    'INSERT INTO health_worker_patients (health_worker_id, patient_id, notes) VALUES (?, ?, ?)',
    [hwId, newPatientId, notes || 'Registered by Health Worker']
  );

  res.status(201).json({
    id: newPatientId,
    email: patientEmail,
    message: `Patient ${name} registered successfully with ID #${newPatientId}.`
  });
}));

// Health worker updates patient profile information
app.put('/api/health-worker/patients/:id', auth('HEALTH_WORKER', 'ADMIN'), wrap(async (req, res) => {
  const patientId = req.params.id;
  const { name, phone, gender, dob, address, language, emergency_contact_name, emergency_contact_phone, medical_history, allergies, current_medications, notes } = req.body;

  await q(
    `UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone), gender = COALESCE(?, gender),
     dob = COALESCE(?, dob), address = COALESCE(?, address), language = COALESCE(?, language),
     emergency_contact_name = COALESCE(?, emergency_contact_name), emergency_contact_phone = COALESCE(?, emergency_contact_phone),
     medical_history = COALESCE(?, medical_history), allergies = COALESCE(?, allergies),
     current_medications = COALESCE(?, current_medications) WHERE id = ?`,
    [name || null, phone || null, gender || null, dob || null, address || null, language || null, emergency_contact_name || null, emergency_contact_phone || null, medical_history || null, allergies || null, current_medications || null, patientId]
  );

  if (notes) {
    const hwRows = await q('SELECT id FROM health_workers WHERE user_id = ?', [req.user.id]);
    if (hwRows.length > 0) {
      await q('UPDATE health_worker_patients SET notes = ? WHERE health_worker_id = ? AND patient_id = ?', [notes, hwRows[0].id, patientId]);
    }
  }

  res.json({ ok: true, message: 'Patient details updated successfully!' });
}));

// Health worker view specific patient record (visits, prescriptions, followups, appointments, consultations)
app.get('/api/health-worker/patients/:id', auth('HEALTH_WORKER', 'ADMIN'), wrap(async (req, res) => {
  const hwRows = await q('SELECT id FROM health_workers WHERE user_id = ?', [req.user.id]);
  if (hwRows.length === 0) return res.status(404).json({ error: 'Health Worker not found.' });
  const hwId = hwRows[0].id;
  const patientId = req.params.id;

  const [patient] = await q(
    `SELECT id, name, email, phone, gender, dob, address, language,
            emergency_contact_name, emergency_contact_phone,
            medical_history, allergies, current_medications, profile_photo
     FROM users WHERE id = ?`,
    [patientId]
  );
  if (!patient) return res.status(404).json({ error: 'Patient not found.' });

  const visits = await q('SELECT * FROM home_visits WHERE patient_id = ? AND health_worker_id = ? ORDER BY visit_date DESC', [patientId, hwId]);
  const followups = await q('SELECT * FROM patient_followups WHERE patient_id = ? AND health_worker_id = ? ORDER BY created_at DESC', [patientId, hwId]);
  
  // All prescriptions issued by doctors for this patient
  const prescriptions = await q(
    `SELECT p.*, du.name AS doctor_name, d.specialization AS doctor_specialization, d.qualification AS doctor_qualification
     FROM prescriptions p
     JOIN doctors d ON d.id = p.doctor_id
     JOIN users du ON du.id = d.user_id
     WHERE p.patient_id = ?
     ORDER BY p.created_at DESC`,
    [patientId]
  );

  for (const rx of prescriptions) {
    rx.items = await q(
      `SELECT pi.*, m.name AS medicine_name, m.dosage_form, m.category
       FROM prescription_items pi
       JOIN medicines m ON m.id = pi.medicine_id
       WHERE pi.prescription_id = ?`,
      [rx.id]
    );
  }

  // All appointments & teleconsultation history for this patient
  const appointments = await q(
    `SELECT a.*, du.name AS doctor_name, d.specialization AS doctor_specialization, d.consultation_fee
     FROM appointments a
     JOIN doctors d ON d.id = a.doctor_id
     JOIN users du ON du.id = d.user_id
     WHERE a.patient_id = ?
     ORDER BY a.date DESC, a.time DESC`,
    [patientId]
  );

  res.json({ patient, visits, followups, prescriptions, appointments });
}));

// Record Home Visit
app.post('/api/health-worker/home-visits', auth('HEALTH_WORKER', 'ADMIN'), wrap(async (req, res) => {
  const hwRows = await q('SELECT id FROM health_workers WHERE user_id = ?', [req.user.id]);
  if (hwRows.length === 0) return res.status(404).json({ error: 'Health worker not found.' });
  const hwId = hwRows[0].id;

  const { patient_id, visit_date, blood_pressure, pulse, blood_sugar, temperature, observations, next_followup_date } = req.body;

  if (!patient_id || !visit_date || !observations) {
    return res.status(400).json({ error: 'Patient, visit date, and clinical observations are required.' });
  }

  const result = await q(
    `INSERT INTO home_visits (health_worker_id, patient_id, visit_date, blood_pressure, pulse, blood_sugar, temperature, observations, next_followup_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [hwId, patient_id, visit_date, blood_pressure || null, pulse || null, blood_sugar || null, temperature || null, observations, next_followup_date || null]
  );

  res.status(201).json({ id: result.insertId, message: 'Home visit recorded successfully!' });
}));

// Get all home visits for health worker
app.get('/api/health-worker/home-visits', auth('HEALTH_WORKER', 'ADMIN'), wrap(async (req, res) => {
  const hwRows = await q('SELECT id FROM health_workers WHERE user_id = ?', [req.user.id]);
  if (hwRows.length === 0) return res.status(404).json({ error: 'Health worker not found.' });
  const hwId = hwRows[0].id;

  const visits = await q(
    `SELECT hv.*, u.name patient_name, u.phone patient_phone
     FROM home_visits hv
     JOIN users u ON u.id = hv.patient_id
     WHERE hv.health_worker_id = ?
     ORDER BY hv.visit_date DESC`,
    [hwId]
  );

  res.json(visits);
}));

// Record Follow-up note
app.post('/api/health-worker/followups', auth('HEALTH_WORKER', 'ADMIN'), wrap(async (req, res) => {
  const hwRows = await q('SELECT id FROM health_workers WHERE user_id = ?', [req.user.id]);
  if (hwRows.length === 0) return res.status(404).json({ error: 'Health worker not found.' });
  const hwId = hwRows[0].id;

  const { patient_id, observation, adherence_notes } = req.body;
  if (!patient_id || !observation) {
    return res.status(400).json({ error: 'Patient and observation are required.' });
  }

  const result = await q(
    'INSERT INTO patient_followups (health_worker_id, patient_id, observation, adherence_notes) VALUES (?, ?, ?, ?)',
    [hwId, patient_id, observation, adherence_notes || null]
  );

  res.status(201).json({ id: result.insertId, message: 'Follow-up observation saved successfully!' });
}));

// Medicine adherence monitoring for assigned patients
app.get('/api/health-worker/medicine-adherence', auth('HEALTH_WORKER', 'ADMIN'), wrap(async (req, res) => {
  const hwRows = await q('SELECT id FROM health_workers WHERE user_id = ?', [req.user.id]);
  if (hwRows.length === 0) return res.status(404).json({ error: 'Health worker not found.' });
  const hwId = hwRows[0].id;

  const adherence = await q(
    `SELECT u.id AS patient_id, u.name AS patient_name,
            m.name AS medicine_name, pi.dosage, pi.frequency,
            r.remind_time, r.status AS reminder_status,
            (SELECT COUNT(*) FROM medicine_dose_logs WHERE reminder_id = r.id AND status = 'Taken') AS taken_count
     FROM health_worker_patients hwp
     JOIN users u ON u.id = hwp.patient_id
     JOIN medicine_reminders r ON r.patient_id = u.id
     JOIN prescription_items pi ON pi.id = r.item_id
     JOIN medicines m ON m.id = pi.medicine_id
     WHERE hwp.health_worker_id = ?
     ORDER BY u.name ASC, r.remind_time ASC`,
    [hwId]
  );

  res.json(adherence);
}));

// ==========================================
// 8. HOSPITALS DIRECTORY & GPS ROUTING
// ==========================================

app.get('/api/hospitals', auth(), wrap(async (req, res) => {
  const search = req.query.search ? `%${req.query.search.trim()}%` : '%';
  const hospitals = await q(
    'SELECT * FROM hospitals WHERE name LIKE ? OR services LIKE ? ORDER BY emergency DESC, name ASC',
    [search, search]
  );
  res.json(hospitals);
}));

app.get('/api/hospitals/nearby', auth(), wrap(async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);
  const search = req.query.search ? `%${req.query.search.trim()}%` : '%';

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: 'Valid latitude and longitude are required.' });
  }

  // Haversine formula calculation for real distances
  const hospitals = await q(
    `SELECT *,
            ROUND(6371 * ACOS(LEAST(1, COS(RADIANS(?)) * COS(RADIANS(lat)) * COS(RADIANS(lng) - RADIANS(?)) + SIN(RADIANS(?)) * SIN(RADIANS(lat)))), 2) AS distance_km
     FROM hospitals
     WHERE name LIKE ? OR services LIKE ?
     ORDER BY distance_km ASC`,
    [lat, lng, lat, search, search]
  );

  res.json(hospitals);
}));

// ==========================================
// 9. NOTIFICATIONS
// ==========================================

app.get('/api/notifications', auth(), wrap(async (req, res) => {
  const notifications = await q(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 20',
    [req.user.id]
  );
  res.json(notifications);
}));

app.put('/api/notifications/:id/read', auth(), wrap(async (req, res) => {
  await q('UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  res.json({ ok: true });
}));

// ==========================================
// 10. ADMIN DASHBOARD APIS
// ==========================================

app.get('/api/admin/dashboard', auth('ADMIN'), wrap(async (req, res) => {
  const countOf = async (sql) => (await q(sql))[0].c;

  res.json({
    totalUsers: await countOf('SELECT COUNT(*) c FROM users'),
    totalPatients: await countOf('SELECT COUNT(*) c FROM users WHERE role = "PATIENT"'),
    totalDoctors: await countOf('SELECT COUNT(*) c FROM doctors'),
    totalHealthWorkers: await countOf('SELECT COUNT(*) c FROM health_workers'),
    totalAppointments: await countOf('SELECT COUNT(*) c FROM appointments'),
    totalPrescriptions: await countOf('SELECT COUNT(*) c FROM prescriptions'),
    totalHospitals: await countOf('SELECT COUNT(*) c FROM hospitals')
  });
}));

app.get('/api/admin/users', auth('ADMIN'), wrap(async (req, res) => {
  const users = await q('SELECT id, name, email, phone, role, created_at FROM users ORDER BY id DESC');
  res.json(users);
}));

app.delete('/api/admin/users/:id', auth('ADMIN'), wrap(async (req, res) => {
  await q('DELETE FROM users WHERE id = ? AND role <> "ADMIN"', [req.params.id]);
  res.json({ ok: true, message: 'User deleted.' });
}));

// ==========================================
// 11. MEDICAL REPORT UPLOAD & SHARING APIS
// ==========================================

const reportsStorageDir = path.join(__dirname, 'uploads', 'medical_reports');
if (!fs.existsSync(reportsStorageDir)) {
  fs.mkdirSync(reportsStorageDir, { recursive: true });
}

const reportUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, reportsStorageDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const safeName = `report_${Date.now()}_${crypto.randomBytes(8).toString('hex')}${ext}`;
      cb(null, safeName);
    }
  }),
  limits: {
    fileSize: 15 * 1024 * 1024 // 15MB max file size
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    const allowedExts = ['.pdf', '.jpeg', '.jpg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedMimes.includes(file.mimetype) && allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file format. Please upload PDF, JPG, JPEG, or PNG files only.'));
    }
  }
});

// Verification helper ensuring only authorized users can view, preview, or download a report
async function verifyReportAccess(user, reportId) {
  const reports = await q(`
    SELECT r.*, u.name AS patient_name, u.email AS patient_email, u.phone AS patient_phone, u.gender AS patient_gender, u.dob AS patient_dob
    FROM medical_reports r
    JOIN users u ON u.id = r.patient_id
    WHERE r.id = ?
  `, [reportId]);

  if (reports.length === 0) return { error: 'Report not found', status: 404 };
  const report = reports[0];

  if (user.role === 'ADMIN') return { report };
  if (user.role === 'PATIENT' && report.patient_id === user.id) return { report };

  if (user.role === 'DOCTOR') {
    const docRows = await q('SELECT id FROM doctors WHERE user_id = ?', [user.id]);
    if (docRows.length > 0) {
      const share = await q(`
        SELECT id FROM medical_report_shares 
        WHERE report_id = ? AND (shared_with_doctor_id = ? OR shared_with_user_id = ?)
      `, [reportId, docRows[0].id, user.id]);
      if (share.length > 0) return { report, doctorId: docRows[0].id };
    }
    return { error: 'Access denied: This report has not been shared with you.', status: 403 };
  }

  if (user.role === 'HEALTH_WORKER') {
    const hwRows = await q('SELECT id FROM health_workers WHERE user_id = ?', [user.id]);
    if (hwRows.length > 0) {
      const assigned = await q(`
        SELECT id FROM health_worker_patients WHERE health_worker_id = ? AND patient_id = ?
      `, [hwRows[0].id, report.patient_id]);
      if (assigned.length > 0 && report.allow_health_worker_access) return { report, healthWorkerId: hwRows[0].id };

      const share = await q(`
        SELECT id FROM medical_report_shares WHERE report_id = ? AND shared_with_user_id = ?
      `, [reportId, user.id]);
      if (share.length > 0) return { report, healthWorkerId: hwRows[0].id };
    }
    return { error: 'Access denied: You are not authorized to access this patient document.', status: 403 };
  }

  return { error: 'Access denied', status: 403 };
}

// Upload a new medical report
app.post('/api/medical-reports', auth(), (req, res, next) => {
  reportUpload.single('report_file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File size exceeds maximum allowed limit (15MB).' });
      }
      return res.status(400).json({ error: `File upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, wrap(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Please select a report file to upload (PDF, JPG, JPEG, or PNG).' });
  }

  const { title, category, description, report_date, share_doctor_id, allow_health_worker_access } = req.body;
  if (!title || !title.trim()) {
    try { fs.unlinkSync(req.file.path); } catch (e) {}
    return res.status(400).json({ error: 'Report title is required.' });
  }

  let targetPatientId = req.user.id;
  if (req.user.role === 'HEALTH_WORKER') {
    const reqPatientId = req.body.patient_id;
    if (!reqPatientId) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
      return res.status(400).json({ error: 'Please select which managed patient this report belongs to.' });
    }
    const hwRows = await q('SELECT id FROM health_workers WHERE user_id = ?', [req.user.id]);
    if (hwRows.length === 0) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
      return res.status(403).json({ error: 'Health worker record not found.' });
    }
    const isAssigned = await q('SELECT id FROM health_worker_patients WHERE health_worker_id = ? AND patient_id = ?', [hwRows[0].id, reqPatientId]);
    if (isAssigned.length === 0) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
      return res.status(403).json({ error: 'You are only authorized to upload reports for patients assigned to your care.' });
    }
    targetPatientId = reqPatientId;
  } else if (req.user.role !== 'PATIENT') {
    try { fs.unlinkSync(req.file.path); } catch (e) {}
    return res.status(403).json({ error: 'Only patients and authorized health workers can upload medical reports.' });
  }

  const reportDateVal = report_date && report_date.trim() ? report_date.trim() : new Date().toISOString().slice(0, 10);
  const allowHw = allow_health_worker_access === 'false' || allow_health_worker_access === false ? false : true;

  const result = await q(`
    INSERT INTO medical_reports 
    (patient_id, title, category, description, report_date, original_file_name, stored_file_name, file_path, file_type, file_size, uploaded_by_user_id, allow_health_worker_access)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    targetPatientId,
    title.trim(),
    category || 'General',
    description ? description.trim() : null,
    reportDateVal,
    req.file.originalname,
    req.file.filename,
    req.file.path,
    req.file.mimetype,
    req.file.size,
    req.user.id,
    allowHw
  ]);

  const reportId = result.insertId;

  // If share_doctor_id provided, share immediately
  if (share_doctor_id) {
    const docRows = await q('SELECT id, user_id FROM doctors WHERE id = ?', [share_doctor_id]);
    if (docRows.length > 0) {
      await q(`
        INSERT IGNORE INTO medical_report_shares (report_id, shared_with_doctor_id, shared_with_user_id, recipient_role, shared_by_user_id, notes)
        VALUES (?, ?, ?, 'DOCTOR', ?, ?)
      `, [reportId, docRows[0].id, docRows[0].user_id, req.user.id, 'Shared during upload']);
    }
  }

  res.status(201).json({
    ok: true,
    message: 'Medical report uploaded successfully!',
    reportId
  });
}));

// List medical reports accessible to the current user
app.get('/api/medical-reports', auth(), wrap(async (req, res) => {
  if (req.user.role === 'PATIENT') {
    const reports = await q(`
      SELECT r.*,
        (SELECT JSON_ARRAYAGG(JSON_OBJECT('share_id', s.id, 'doctor_id', d.id, 'doctor_name', u_d.name, 'specialization', d.specialization, 'shared_at', s.created_at))
         FROM medical_report_shares s
         JOIN doctors d ON d.id = s.shared_with_doctor_id
         JOIN users u_d ON u_d.id = d.user_id
         WHERE s.report_id = r.id) AS shared_doctors
      FROM medical_reports r
      WHERE r.patient_id = ?
      ORDER BY r.report_date DESC, r.id DESC
    `, [req.user.id]);

    const formatted = reports.map((r) => ({
      ...r,
      shared_doctors: typeof r.shared_doctors === 'string' ? JSON.parse(r.shared_doctors) : (r.shared_doctors || [])
    }));
    return res.json(formatted);
  }

  if (req.user.role === 'DOCTOR') {
    const docRows = await q('SELECT id FROM doctors WHERE user_id = ?', [req.user.id]);
    if (docRows.length === 0) return res.status(404).json({ error: 'Doctor record not found.' });
    const doctorId = docRows[0].id;

    let sql = `
      SELECT r.*, u_p.name AS patient_name, u_p.email AS patient_email, u_p.phone AS patient_phone, u_p.gender AS patient_gender, u_p.dob AS patient_dob,
             s.id AS share_id, s.created_at AS shared_at, s.notes AS share_notes
      FROM medical_report_shares s
      JOIN medical_reports r ON r.id = s.report_id
      JOIN users u_p ON u_p.id = r.patient_id
      WHERE s.shared_with_doctor_id = ?
    `;
    const params = [doctorId];

    if (req.query.patient_id) {
      sql += ' AND r.patient_id = ?';
      params.push(req.query.patient_id);
    }
    if (req.query.category && req.query.category !== 'ALL') {
      sql += ' AND r.category = ?';
      params.push(req.query.category);
    }

    sql += ' ORDER BY r.report_date DESC, r.id DESC';
    const reports = await q(sql, params);
    return res.json(reports);
  }

  if (req.user.role === 'HEALTH_WORKER') {
    const hwRows = await q('SELECT id FROM health_workers WHERE user_id = ?', [req.user.id]);
    if (hwRows.length === 0) return res.status(404).json({ error: 'Health worker record not found.' });
    const hwId = hwRows[0].id;

    let sql = `
      SELECT r.*, u_p.name AS patient_name, u_p.phone AS patient_phone,
        (SELECT JSON_ARRAYAGG(JSON_OBJECT('share_id', s.id, 'doctor_id', d.id, 'doctor_name', u_d.name, 'specialization', d.specialization, 'shared_at', s.created_at))
         FROM medical_report_shares s
         JOIN doctors d ON d.id = s.shared_with_doctor_id
         JOIN users u_d ON u_d.id = d.user_id
         WHERE s.report_id = r.id) AS shared_doctors
      FROM medical_reports r
      JOIN users u_p ON u_p.id = r.patient_id
      WHERE ((r.patient_id IN (SELECT patient_id FROM health_worker_patients WHERE health_worker_id = ?) AND r.allow_health_worker_access = TRUE)
         OR r.id IN (SELECT report_id FROM medical_report_shares WHERE shared_with_user_id = ?))
    `;
    const params = [hwId, req.user.id];

    if (req.query.patient_id) {
      sql += ' AND r.patient_id = ?';
      params.push(req.query.patient_id);
    }
    if (req.query.category && req.query.category !== 'ALL') {
      sql += ' AND r.category = ?';
      params.push(req.query.category);
    }

    sql += ' ORDER BY r.report_date DESC, r.id DESC';
    const reports = await q(sql, params);
    const formatted = reports.map((r) => ({
      ...r,
      shared_doctors: typeof r.shared_doctors === 'string' ? JSON.parse(r.shared_doctors) : (r.shared_doctors || [])
    }));
    return res.json(formatted);
  }

  if (req.user.role === 'ADMIN') {
    const reports = await q(`
      SELECT r.*, u_p.name AS patient_name
      FROM medical_reports r
      JOIN users u_p ON u_p.id = r.patient_id
      ORDER BY r.id DESC LIMIT 100
    `);
    return res.json(reports);
  }

  res.json([]);
}));

// Get single medical report metadata and clinical notes
app.get('/api/medical-reports/:id', auth(), wrap(async (req, res) => {
  const check = await verifyReportAccess(req.user, req.params.id);
  if (check.error) return res.status(check.status).json({ error: check.error });

  const notes = await q(`
    SELECT n.*, du.name AS doctor_name, d.specialization
    FROM medical_report_clinical_notes n
    JOIN doctors d ON d.id = n.doctor_id
    JOIN users du ON du.id = d.user_id
    WHERE n.report_id = ?
    ORDER BY n.id ASC
  `, [req.params.id]);

  const shares = await q(`
    SELECT s.*, d.specialization, du.name AS doctor_name
    FROM medical_report_shares s
    LEFT JOIN doctors d ON d.id = s.shared_with_doctor_id
    LEFT JOIN users du ON du.id = d.user_id
    WHERE s.report_id = ?
  `, [req.params.id]);

  res.json({
    ...check.report,
    clinical_notes: notes,
    shares
  });
}));

// Preview medical report (inline display for PDF and images)
app.get('/api/medical-reports/:id/preview', auth(), wrap(async (req, res) => {
  const check = await verifyReportAccess(req.user, req.params.id);
  if (check.error) return res.status(check.status).json({ error: check.error });

  const report = check.report;
  if (!fs.existsSync(report.file_path)) {
    return res.status(404).json({ error: 'Report file not found on server.' });
  }

  res.setHeader('Content-Type', report.file_type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(report.original_file_name)}"`);
  fs.createReadStream(report.file_path).pipe(res);
}));

// Download medical report
app.get('/api/medical-reports/:id/download', auth(), wrap(async (req, res) => {
  const check = await verifyReportAccess(req.user, req.params.id);
  if (check.error) return res.status(check.status).json({ error: check.error });

  const report = check.report;
  if (!fs.existsSync(report.file_path)) {
    return res.status(404).json({ error: 'Report file not found on server.' });
  }

  res.download(report.file_path, report.original_file_name);
}));

// Share report with a doctor
app.post('/api/medical-reports/:id/share', auth(), wrap(async (req, res) => {
  const { doctor_id, notes } = req.body;
  if (!doctor_id) {
    return res.status(400).json({ error: 'Please select a doctor to share this report with.' });
  }

  // Caller must be report owner (patient) or assigned health worker
  const check = await verifyReportAccess(req.user, req.params.id);
  if (check.error) return res.status(check.status).json({ error: check.error });
  if (req.user.role === 'DOCTOR') {
    return res.status(403).json({ error: 'Only patients and authorized health workers can share medical reports.' });
  }

  const docRows = await q('SELECT id, user_id FROM doctors WHERE id = ?', [doctor_id]);
  if (docRows.length === 0) {
    return res.status(404).json({ error: 'Doctor not found.' });
  }

  await q(`
    INSERT INTO medical_report_shares (report_id, shared_with_doctor_id, shared_with_user_id, recipient_role, shared_by_user_id, notes)
    VALUES (?, ?, ?, 'DOCTOR', ?, ?)
    ON DUPLICATE KEY UPDATE notes = VALUES(notes)
  `, [req.params.id, docRows[0].id, docRows[0].user_id, req.user.id, notes ? notes.trim() : 'Shared by patient']);

  // Add notification for doctor
  try {
    await q(`
      INSERT INTO notifications (user_id, title, message)
      VALUES (?, 'New Patient Medical Report', ?)
    `, [docRows[0].user_id, `Patient ${check.report.patient_name} shared medical report: "${check.report.title}" (${check.report.category}).`]);
  } catch (err) {}

  res.json({ ok: true, message: 'Medical report shared with doctor successfully!' });
}));

// Revoke report share
app.delete('/api/medical-reports/:id/share/:shareId', auth(), wrap(async (req, res) => {
  const check = await verifyReportAccess(req.user, req.params.id);
  if (check.error) return res.status(check.status).json({ error: check.error });
  if (req.user.role !== 'PATIENT' && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Only the patient can revoke doctor access to their report.' });
  }

  await q('DELETE FROM medical_report_shares WHERE id = ? AND report_id = ?', [req.params.shareId, req.params.id]);
  res.json({ ok: true, message: 'Report access revoked successfully.' });
}));

// Update health worker access flag
app.patch('/api/medical-reports/:id/health-worker-access', auth('PATIENT'), wrap(async (req, res) => {
  const { allow_health_worker_access } = req.body;
  const val = allow_health_worker_access ? 1 : 0;
  await q('UPDATE medical_reports SET allow_health_worker_access = ? WHERE id = ? AND patient_id = ?', [
    val,
    req.params.id,
    req.user.id
  ]);
  res.json({ ok: true, message: `Health worker access ${val ? 'granted' : 'revoked'} successfully.`, allow_health_worker_access: !!val });
}));

// Delete medical report
app.delete('/api/medical-reports/:id', auth(), wrap(async (req, res) => {
  const check = await verifyReportAccess(req.user, req.params.id);
  if (check.error) return res.status(check.status).json({ error: check.error });
  if (req.user.role !== 'PATIENT' && req.user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Only the patient who uploaded this report can delete it.' });
  }

  const report = check.report;
  if (fs.existsSync(report.file_path)) {
    try { fs.unlinkSync(report.file_path); } catch (e) {}
  }

  await q('DELETE FROM medical_reports WHERE id = ?', [req.params.id]);
  res.json({ ok: true, message: 'Medical report deleted successfully.' });
}));

// Doctor add clinical observation note to report
app.post('/api/medical-reports/:id/notes', auth('DOCTOR'), wrap(async (req, res) => {
  const { notes } = req.body;
  if (!notes || !notes.trim()) {
    return res.status(400).json({ error: 'Clinical note cannot be empty.' });
  }

  const check = await verifyReportAccess(req.user, req.params.id);
  if (check.error) return res.status(check.status).json({ error: check.error });

  const docRows = await q('SELECT id FROM doctors WHERE user_id = ?', [req.user.id]);
  if (docRows.length === 0) return res.status(404).json({ error: 'Doctor not found.' });

  await q(`
    INSERT INTO medical_report_clinical_notes (report_id, doctor_id, notes)
    VALUES (?, ?, ?)
  `, [req.params.id, docRows[0].id, notes.trim()]);

  res.status(201).json({ ok: true, message: 'Clinical observation saved successfully!' });
}));

// Teleconsultation room: get shared reports for appointment patient
app.get('/api/consultations/:appointmentId/reports', auth(), wrap(async (req, res) => {
  const apt = await checkConsultationAccess(req.user, req.params.appointmentId);
  if (!apt) return res.status(403).json({ error: 'Access denied to this consultation.' });

  if (req.user.role === 'DOCTOR') {
    const docRows = await q('SELECT id FROM doctors WHERE user_id = ?', [req.user.id]);
    if (docRows.length === 0) return res.status(404).json({ error: 'Doctor not found.' });

    const reports = await q(`
      SELECT r.*, s.created_at AS shared_at
      FROM medical_report_shares s
      JOIN medical_reports r ON r.id = s.report_id
      WHERE s.shared_with_doctor_id = ? AND r.patient_id = ?
      ORDER BY r.report_date DESC
    `, [docRows[0].id, apt.patient_id]);
    return res.json(reports);
  }

  if (req.user.role === 'PATIENT') {
    const reports = await q(`
      SELECT r.* FROM medical_reports r
      WHERE r.patient_id = ?
      ORDER BY r.report_date DESC
    `, [req.user.id]);
    return res.json(reports);
  }

  if (req.user.role === 'HEALTH_WORKER') {
    const reports = await q(`
      SELECT r.* FROM medical_reports r
      WHERE r.patient_id = ? AND r.allow_health_worker_access = TRUE
      ORDER BY r.report_date DESC
    `, [apt.patient_id]);
    return res.json(reports);
  }

  res.json([]);
}));

// Health check endpoints for cloud load balancers and deployment monitoring
app.get(['/health', '/api/health'], (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'MediConnect AI Healthcare API',
    uptime: process.uptime()
  });
});

// Production static file serving & SPA fallback
const clientDistPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  console.log(`📦 Serving compiled frontend from ${clientDistPath}`);
  app.use(express.static(clientDistPath));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else {
  // Helpful root response if frontend is hosted on a separate static platform
  app.get('/', (req, res) => {
    res.json({
      name: 'MediConnect AI Healthcare API',
      status: 'online',
      health: '/api/health',
      timestamp: new Date().toISOString()
    });
  });
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 MediConnect AI Server & Teleconsultation WebSocket running on port ${PORT} (bound to 0.0.0.0)`);
});


