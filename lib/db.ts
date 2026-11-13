import { Pool } from 'pg';
let pool: Pool | undefined;
export function getPool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured.');
  pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : undefined,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });
  return pool;
}
