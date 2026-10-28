-- MediConnect AI - Healthcare Portal Database Schema
CREATE DATABASE IF NOT EXISTS healthcare_portal;
USE healthcare_portal;

-- 1. Users table (Supports PATIENT, DOCTOR, HEALTH_WORKER, ADMIN)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  phone VARCHAR(20),
  password_hash VARCHAR(100) NOT NULL,
  gender VARCHAR(10),
  dob DATE,
  address VARCHAR(255),
  language VARCHAR(20) DEFAULT 'English',
  emergency_contact_name VARCHAR(100),
  emergency_contact_phone VARCHAR(20),
  medical_history TEXT,
  allergies TEXT,
  current_medications TEXT,
  profile_photo TEXT,
  role ENUM('PATIENT', 'DOCTOR', 'HEALTH_WORKER', 'ADMIN') NOT NULL DEFAULT 'PATIENT',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_role (role)
);

-- 2. Doctor profiles & Availability
CREATE TABLE IF NOT EXISTS doctors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  specialization VARCHAR(80) NOT NULL,
  experience INT DEFAULT 0,
  qualification VARCHAR(100) DEFAULT 'MBBS, MD',
  start_time TIME DEFAULT '09:00:00',
  end_time TIME DEFAULT '17:00:00',
  slot_duration_mins INT DEFAULT 30,
  available_days VARCHAR(100) DEFAULT 'Mon,Tue,Wed,Thu,Fri,Sat',
  consultation_fee INT DEFAULT 500,
  bio TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_spec (specialization)
);

-- 3. Health Worker profiles
CREATE TABLE IF NOT EXISTS health_workers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  assigned_area VARCHAR(100) NOT NULL DEFAULT 'Zone A - Primary Health Care',
  health_centre VARCHAR(150) DEFAULT 'Perundurai Primary Health Centre',
  location VARCHAR(150) DEFAULT 'Zone A, Erode District',
  employee_id VARCHAR(50) DEFAULT 'HW-101',
  qualification VARCHAR(100) DEFAULT 'Certified Health Worker (ANM/ASHA)',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. Health Worker to Patient Assignments
CREATE TABLE IF NOT EXISTS health_worker_patients (
  id INT AUTO_INCREMENT PRIMARY KEY,
  health_worker_id INT NOT NULL,
  patient_id INT NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  UNIQUE KEY hw_patient (health_worker_id, patient_id),
  FOREIGN KEY (health_worker_id) REFERENCES health_workers(id) ON DELETE CASCADE,
  FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 5. Appointments table
CREATE TABLE IF NOT EXISTS appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  doctor_id INT NOT NULL,
  date DATE NOT NULL,
  time TIME NOT NULL,
  reason VARCHAR(255),
  consultation_type VARCHAR(30) DEFAULT 'Video',
  status ENUM('Pending', 'Confirmed', 'Cancelled', 'Completed', 'Rejected') DEFAULT 'Pending',
  meeting_status VARCHAR(50) DEFAULT 'Scheduled',
  consultation_start_time TIMESTAMP NULL,
  consultation_end_time TIMESTAMP NULL,
  booked_by_health_worker_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY slot (doctor_id, date, time),
  FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
  FOREIGN KEY (booked_by_health_worker_id) REFERENCES health_workers(id) ON DELETE SET NULL,
  INDEX idx_apt_date (date)
);

-- 6. Consultation Messages (Chat & Teleconsultation transcript)
CREATE TABLE IF NOT EXISTS consultation_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT NOT NULL,
  sender_id INT NOT NULL,
  text TEXT NOT NULL,
  language VARCHAR(20) DEFAULT 'English',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 7. Medicines Master List
CREATE TABLE IF NOT EXISTS medicines (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  category VARCHAR(80) DEFAULT 'General',
  description VARCHAR(255),
  dosage_form VARCHAR(50) DEFAULT 'Tablet'
);

-- 8. Prescriptions (Issued by Doctors only)
CREATE TABLE IF NOT EXISTS prescriptions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT NULL,
  patient_id INT NOT NULL,
  doctor_id INT NOT NULL,
  diagnosis VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE SET NULL,
  FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
);

-- 9. Prescription Items
CREATE TABLE IF NOT EXISTS prescription_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  prescription_id INT NOT NULL,
  medicine_id INT NOT NULL,
  dosage VARCHAR(50) NOT NULL,
  frequency INT DEFAULT 1,
  days INT DEFAULT 5,
  instructions VARCHAR(255),
  start_date DATE,
  end_date DATE,
  FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE,
  FOREIGN KEY (medicine_id) REFERENCES medicines(id) ON DELETE RESTRICT
);

-- 10. Medicine Reminders & Dose Schedules
CREATE TABLE IF NOT EXISTS medicine_reminders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  item_id INT NOT NULL,
  remind_time TIME NOT NULL,
  status ENUM('Active', 'Completed') DEFAULT 'Active',
  FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (item_id) REFERENCES prescription_items(id) ON DELETE CASCADE
);

-- 11. Medicine Dose Logs (Daily Adherence Tracking)
CREATE TABLE IF NOT EXISTS medicine_dose_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  reminder_id INT NOT NULL,
  patient_id INT NOT NULL,
  dose_date DATE NOT NULL,
  taken_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('Taken', 'Missed') DEFAULT 'Taken',
  UNIQUE KEY dose_daily (reminder_id, dose_date),
  FOREIGN KEY (reminder_id) REFERENCES medicine_reminders(id) ON DELETE CASCADE,
  FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 12. Home Visit Records (By Health Workers)
CREATE TABLE IF NOT EXISTS home_visits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  health_worker_id INT NOT NULL,
  patient_id INT NOT NULL,
  visit_date DATE NOT NULL,
  blood_pressure VARCHAR(20),
  pulse VARCHAR(20),
  blood_sugar VARCHAR(20),
  temperature VARCHAR(20),
  observations TEXT NOT NULL,
  next_followup_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (health_worker_id) REFERENCES health_workers(id) ON DELETE CASCADE,
  FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 13. Patient Follow-up Records (By Health Workers)
CREATE TABLE IF NOT EXISTS patient_followups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  health_worker_id INT NOT NULL,
  patient_id INT NOT NULL,
  observation TEXT NOT NULL,
  adherence_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (health_worker_id) REFERENCES health_workers(id) ON DELETE CASCADE,
  FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 14. AI Health Interactions
CREATE TABLE IF NOT EXISTS ai_interactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  symptoms VARCHAR(255),
  query TEXT NOT NULL,
  response TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 15. Hospitals Directory
CREATE TABLE IF NOT EXISTS hospitals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  address VARCHAR(255),
  phone VARCHAR(20),
  services VARCHAR(255),
  emergency BOOLEAN DEFAULT FALSE,
  lat DOUBLE NOT NULL,
  lng DOUBLE NOT NULL
);

-- 16. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  message VARCHAR(255) NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
