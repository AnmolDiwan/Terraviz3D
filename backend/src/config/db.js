import pg from 'pg';
import env from './env.js';

const { Pool } = pg;

const db = new Pool({
  host:     env.DB_HOST,
  port:     env.DB_PORT,
  database: env.DB_NAME,
  user:     env.DB_USER,
  password: env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

db.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export async function initDb() {
  const schemaSql = `
    CREATE EXTENSION IF NOT EXISTS pg_trgm;

    CREATE TABLE IF NOT EXISTS users (
      user_id SERIAL PRIMARY KEY,
      username VARCHAR(50) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'USER',
      failed_attempts INT DEFAULT 0,
      locked_until TIMESTAMPTZ DEFAULT NULL,
      last_login TIMESTAMPTZ DEFAULT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS auth_tokens (
      token_id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
      token TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      revoked BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS sessions (
      session_id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
      token_id INT REFERENCES auth_tokens(token_id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      log_id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(user_id) ON DELETE SET NULL,
      event_type VARCHAR(50) NOT NULL,
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS rag_chunks (
      id SERIAL PRIMARY KEY,
      source_id VARCHAR(100) UNIQUE NOT NULL,
      category VARCHAR(50) NOT NULL,
      chunk_type VARCHAR(20) NOT NULL,
      text TEXT NOT NULL,
      embedding JSONB NOT NULL,
      metadata JSONB NOT NULL,
      indexed_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS rag_edges (
      id SERIAL PRIMARY KEY,
      source_id INTEGER REFERENCES rag_chunks(id) ON DELETE CASCADE,
      target_id INTEGER REFERENCES rag_chunks(id) ON DELETE CASCADE,
      edge_type VARCHAR(50) NOT NULL,
      weight FLOAT NOT NULL,
      UNIQUE(source_id, target_id, edge_type)
    );

    CREATE INDEX IF NOT EXISTS idx_rag_metadata ON rag_chunks USING gin (metadata);
    CREATE INDEX IF NOT EXISTS idx_rag_text ON rag_chunks USING gin (to_tsvector('english', text));
    CREATE INDEX IF NOT EXISTS idx_rag_edges_source ON rag_edges (source_id);
    CREATE INDEX IF NOT EXISTS idx_rag_edges_target ON rag_edges (target_id);
  `;

  await db.query(schemaSql);
  console.log('✅ PostgreSQL schema verified and tables initialized');
}

export default db;
