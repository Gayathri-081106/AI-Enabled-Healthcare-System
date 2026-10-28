# MediConnect AI – Integrated Healthcare & Telemedicine Portal

A full-stack, human-friendly healthcare web portal built with **React, Vite, Node.js, Express, MySQL, and CSS**. MediConnect AI connects patients, doctors, and community health workers into a unified clinical workflow supporting appointments, teleconsultations, digital prescriptions, daily medicine tracking, AI symptom triage, and home visits.

> **Academic Demonstration Notice:** This application is an educational and academic demonstration project. It does not replace professional clinical evaluation, licensed medical diagnoses, or emergency care. In case of acute medical emergencies, immediately contact local emergency services (108 / 112).

---

## 🌟 Key Role Features

### 🧑 1. Patient Portal
- **Overview Dashboard**: Upcoming consultations, daily dose reminders, and active prescriptions retrieved from MySQL.
- **AI Health Support & Triage**: Symptom selector and query description with structured triage evaluation (emergency warnings, home care advice, recommended doctor consultation).
- **Find a Doctor**: Directory of registered doctors with specialties, qualifications, experience, working hours, and direct booking.
- **Book Appointment**: Validates doctor working hours, prevents double-booking of slots, and confirms booking directly to MySQL.
- **My Appointments**: Tabbed view of upcoming, confirmed, completed, and cancelled appointments with one-click teleconsultation launch.
- **Teleconsultation**: Real-time consultation room supporting browser camera/microphone media streaming (`getUserMedia`), mute/unmute audio, video on/off toggles, and live in-call clinical messaging.
- **My Prescriptions**: Read-only access to doctor-issued prescriptions, complete with diagnosis, dosage, frequency, days, and instructions.
- **Medicine Tracker**: Log daily scheduled doses as taken, track compliance timestamps, and toggle reminder alerts.
- **Nearby Hospitals**: Real GPS distance calculation (Haversine formula), emergency center tags, interactive OpenStreetMap view, and turn-by-turn directions links.
- **My Profile**: View and edit contact details, emergency contacts, and preferred language.

### 🩺 2. Doctor Portal
- **Clinical Dashboard**: Real-time metrics for today's appointments, pending patient requests, unique patients consulted, and issued prescriptions.
- **My Patients**: Search and open clinical medical history records for patients who have consulted with the doctor.
- **Appointment Management**: Review, accept (confirm), reject, or complete patient appointment requests.
- **Availability Editor**: Configure working hours (`start_time`, `end_time`), slot duration (e.g. 30 mins), and available weekdays saved in MySQL.
- **Teleconsultation Room**: Join scheduled patient video rooms with camera/audio controls and in-call messaging.
- **Digital Prescriptions**: Issue new prescriptions with multi-medicine selection from master catalog, frequency, days, and patient instructions. Automatically creates scheduled reminders for the patient.
- **My Profile**: Update specialty, qualification, experience, fee, and professional biography.

### 📋 3. Community Health Worker Portal
- **Field Dashboard**: Overview of managed patients, completed home visits, and scheduled follow-ups.
- **My Patients**: Search and view community residents assigned to the health worker.
- **Register Patient**: Register resident patients into MySQL with name, age/DOB, gender, address, language, and emergency contacts, automatically linking them to the health worker.
- **Patient Records & Vitals**: Record clinical observations and track vital signs (Blood Pressure, Pulse, Blood Sugar, Temperature). Doctor prescriptions remain protected.
- **Medicine Follow-up**: Review adherence rates and log observations on patient medication compliance.
- **Home Visit Records**: Comprehensive logs of field visits with vitals history and next visit scheduling.
- **My Profile**: Update assigned community area and qualifications.

### 👑 4. Hospital Administrator Portal
- System-wide statistics for users, patients, doctors, health workers, and appointments.
- Complete user directory with role assignment management.

---

## 🔑 Demo Access & One-Click "Try Demo" Buttons

The login portals and selection hub feature instant **"Try Demo"** buttons that authenticate immediately using pre-configured database records:
- **Doctor Portal**: Click **"Try Demo (Doctor)"** to log in as **Dr. Priya Sharma** (`priya@demo.com`) and open the Doctor Dashboard.
- **Health Worker Portal**: Click **"Try Demo (Health Worker)"** to log in as **Sarala Devi** (`hw1@demo.com`) and open the Health Worker Dashboard.
- **Patient Portal**: Click **"Try Demo (Patient)"** to log in as **Rajesh Kumar** (`patient1@demo.com`) and open the Patient Dashboard.

All demo accounts share the password: `Password@123`

| Role | Email | Name | Details |
|---|---|---|---|
| **Patient** | `patient1@demo.com` | Rajesh Kumar | Cardiology & GP Patient |
| **Patient** | `patient2@demo.com` | Ananya Sharma | General Medicine Patient |
| **Doctor** | `priya@demo.com` | Dr. Priya Sharma | Cardiology Specialist |
| **Doctor** | `arun@demo.com` | Dr. Arun Patel | General Medicine Specialist |
| **Doctor** | `meena@demo.com` | Dr. Meena Iyer | Pediatrics Specialist |
| **Health Worker** | `hw1@demo.com` | Sarala Devi | Zone A (ANM / ASHA) |
| **Health Worker** | `hw2@demo.com` | Malathi R | Zone B (ASHA Facilitator) |
| **Admin** | `admin@demo.com` | System Admin | Healthcare HQ |

---

## 🛠️ Technology Stack

- **Frontend**: React 18, Vite, Lucide Icons, Axios, Pure CSS Design System.
- **Backend**: Node.js (ES Modules), Express.js, JWT, bcryptjs, CORS.
- **Database**: MySQL 8.0 with relational foreign keys, cascade deletes, and parameterized queries.
- **Telemedicine**: WebRTC / Browser `navigator.mediaDevices.getUserMedia` with video stream preview, microphone toggles, and live chat.
- **Geolocation & Maps**: HTML5 Geolocation API, OpenStreetMap, OSRM car routing engine.

---

## 🚀 Quick Setup & Execution

### 1. Database Setup
Ensure MySQL 8.0 is running locally (e.g., on default port 3306).
Review `server/.env` to confirm database credentials:
```env
PORT=5000
DB_HOST=localhost
DB_USER=Gayathri
DB_PASSWORD=
DB_NAME=healthcare_portal
JWT_SECRET=mediconnect_ai_jwt_secret_key_2026_secure
AI_API_KEY=
```
*(Optional: Provide an OpenAI API key in `AI_API_KEY` for GPT-4o-mini powered triage; otherwise, the built-in clinical triage rule engine runs automatically).*

### 2. Install Dependencies
Run from the project root:
```bash
npm run install:all
```

### 3. Initialize & Seed Database
Executes `database/schema.sql` and loads realistic initial demo data:
```bash
npm run seed
```

### 4. Start Application
Runs both the Express API (port 5000) and the Vite frontend (port 5173):
```bash
npm run dev
```

Open your browser at: **http://localhost:5173**
