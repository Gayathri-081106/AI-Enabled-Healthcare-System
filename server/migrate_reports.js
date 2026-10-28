import db from './db.js';

async function migrateReports() {
  console.log('Running medical reports database migration...');

  await db.query(`
    CREATE TABLE IF NOT EXISTS medical_reports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      patient_id INT NOT NULL,
      title VARCHAR(150) NOT NULL,
      category VARCHAR(80) NOT NULL DEFAULT 'General',
      description TEXT,
      report_date DATE NOT NULL,
      original_file_name VARCHAR(255) NOT NULL,
      stored_file_name VARCHAR(255) NOT NULL,
      file_path VARCHAR(255) NOT NULL,
      file_type VARCHAR(100) NOT NULL,
      file_size INT NOT NULL,
      uploaded_by_user_id INT NOT NULL,
      allow_health_worker_access BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_patient (patient_id),
      INDEX idx_category (category),
      INDEX idx_report_date (report_date)
    )
  `);
  console.log('✅ medical_reports table created/ready');

  await db.query(`
    CREATE TABLE IF NOT EXISTS medical_report_shares (
      id INT AUTO_INCREMENT PRIMARY KEY,
      report_id INT NOT NULL,
      shared_with_doctor_id INT NULL,
      shared_with_user_id INT NULL,
      recipient_role ENUM('DOCTOR', 'HEALTH_WORKER') NOT NULL DEFAULT 'DOCTOR',
      shared_by_user_id INT NOT NULL,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_report_doctor_share (report_id, shared_with_doctor_id),
      FOREIGN KEY (report_id) REFERENCES medical_reports(id) ON DELETE CASCADE,
      FOREIGN KEY (shared_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (shared_with_doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
      FOREIGN KEY (shared_with_user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  console.log('✅ medical_report_shares table created/ready');

  await db.query(`
    CREATE TABLE IF NOT EXISTS medical_report_clinical_notes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      report_id INT NOT NULL,
      doctor_id INT NOT NULL,
      notes TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (report_id) REFERENCES medical_reports(id) ON DELETE CASCADE,
      FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
    )
  `);
  console.log('✅ medical_report_clinical_notes table created/ready');

  console.log('Migration finished successfully.');
  process.exit(0);
}

migrateReports().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
