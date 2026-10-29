import mysql from 'mysql2/promise';
import 'dotenv/config';

// Build connection configuration supporting both individual env vars and connection strings
function createDbPool() {
  const connectionUrl = process.env.DATABASE_URL || process.env.MYSQL_URL;

  // Cloud hosted MySQL databases typically require SSL
  const isRemote = (process.env.DB_HOST && process.env.DB_HOST !== 'localhost' && process.env.DB_HOST !== '127.0.0.1') || !!connectionUrl;
  const useSsl = process.env.DB_SSL === 'true' || (isRemote && process.env.DB_SSL !== 'false');

  const sslOption = useSsl ? { rejectUnauthorized: false } : undefined;

  if (connectionUrl) {
    try {
      const url = new URL(connectionUrl);
      return mysql.createPool({
        host: url.hostname,
        port: url.port ? parseInt(url.port, 10) : 3306,
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.replace(/^\//, '') || process.env.DB_NAME || 'healthcare_portal',
        waitForConnections: true,
        connectionLimit: 10,
        dateStrings: true,
        ssl: sslOption
      });
    } catch (err) {
      console.warn('⚠️ Could not parse DATABASE_URL as URL, falling back to uri string:', err.message);
      return mysql.createPool({
        uri: connectionUrl,
        waitForConnections: true,
        connectionLimit: 10,
        dateStrings: true,
        ssl: sslOption
      });
    }
  }

  return mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'healthcare_portal',
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true,
    ssl: sslOption
  });
}

const pool = createDbPool();

export default pool;

