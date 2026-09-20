import pg from 'pg';
import env from './env.js';

const { Pool } = pg;

const db = new Pool({
  host:     env.DB_HOST,
  port:     env.DB_PORT,
  database: env.DB_NAME,
  user:     env.DB_USER,
  password: env.DB_PASSWORD,
});

db.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export default db;
