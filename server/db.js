import mysql from 'mysql2/promise';
import 'dotenv/config';

// Build connection configuration supporting individual env vars, Railway variables, and connection strings
function createDbPool() {
  const connectionUrl = process.env.DATABASE_URL || process.env.MYSQL_URL;

  const host = process.env.DB_HOST || process.env.MYSQLHOST || 'localhost';
  const port = process.env.DB_PORT || process.env.MYSQLPORT ? parseInt(process.env.DB_PORT || process.env.MYSQLPORT, 10) : 3306;
  const user = process.env.DB_USER || process.env.MYSQLUSER || 'root';
  const password = process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : (process.env.MYSQLPASSWORD || '');
  const database = process.env.DB_NAME || process.env.MYSQLDATABASE || 'healthcare_portal';

  // Cloud hosted MySQL databases typically require SSL, except private internal networks (e.g. railway.internal)
  const isInternalNetwork = (host && host.includes('railway.internal')) || (connectionUrl && connectionUrl.includes('railway.internal'));
  const isRemote = ((host !== 'localhost' && host !== '127.0.0.1') || !!connectionUrl) && !isInternalNetwork;
  const useSsl = process.env.DB_SSL === 'true' || (isRemote && process.env.DB_SSL !== 'false');

  const sslOption = useSsl ? { rejectUnauthorized: false } : undefined;

  if (connectionUrl) {
    try {
      const url = new URL(connectionUrl);
      const isUrlInternal = url.hostname.includes('railway.internal');
      const urlUseSsl = process.env.DB_SSL === 'true' || (!isUrlInternal && process.env.DB_SSL !== 'false');
      const urlSslOption = urlUseSsl ? { rejectUnauthorized: false } : undefined;

      return mysql.createPool({
        host: url.hostname,
        port: url.port ? parseInt(url.port, 10) : 3306,
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
        database: url.pathname.replace(/^\//, '') || database,
        waitForConnections: true,
        connectionLimit: 10,
        dateStrings: true,
        ssl: urlSslOption
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
    host,
    port,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true,
    ssl: sslOption
  });
}

const pool = createDbPool();

export default pool;

