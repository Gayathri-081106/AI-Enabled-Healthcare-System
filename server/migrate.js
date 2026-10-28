import db from './db.js';

async function migrate() {
  console.log('Running schema enhancements...');

  const addColumn = async (table, col, definition) => {
    try {
      await db.query(`ALTER TABLE ${table} ADD COLUMN ${col} ${definition}`);
      console.log(`✅ Added ${col} to ${table}`);
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log(`ℹ️ Column ${col} already exists in ${table}`);
      } else {
        console.error(`❌ Error adding ${col} to ${table}:`, err.message);
      }
    }
  };

  // 1. users table: medical history, allergies, medications, profile photo
  await addColumn('users', 'profile_photo', 'TEXT NULL');
  await addColumn('users', 'medical_history', 'TEXT NULL');
  await addColumn('users', 'allergies', 'TEXT NULL');
  await addColumn('users', 'current_medications', 'TEXT NULL');

  // 2. health_workers table: health_centre, location
  await addColumn('health_workers', 'health_centre', "VARCHAR(150) DEFAULT 'Perundurai Primary Health Centre'");
  await addColumn('health_workers', 'location', "VARCHAR(150) DEFAULT 'Zone A, Erode District'");

  // 3. appointments table: consultation_type, consultation_start_time, consultation_end_time, meeting_status
  await addColumn('appointments', 'consultation_type', "VARCHAR(30) DEFAULT 'Video'");
  await addColumn('appointments', 'consultation_start_time', 'TIMESTAMP NULL');
  await addColumn('appointments', 'consultation_end_time', 'TIMESTAMP NULL');

  try {
    await db.query("ALTER TABLE appointments MODIFY COLUMN meeting_status VARCHAR(50) DEFAULT 'Scheduled'");
    console.log("✅ Modified meeting_status in appointments to VARCHAR(50)");
  } catch (err) {
    console.error("Modify meeting_status:", err.message);
  }

  console.log('Schema enhancements complete!');
  process.exit(0);
}

migrate().catch(e => {
  console.error('Migration failed:', e);
  process.exit(1);
});
