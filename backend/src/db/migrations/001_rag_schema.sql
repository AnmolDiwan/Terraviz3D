CREATE EXTENSION IF NOT EXISTS pg_trgm;

DROP TABLE IF EXISTS rag_edges CASCADE;
DROP TABLE IF EXISTS rag_chunks CASCADE;

CREATE TABLE rag_chunks (
    id SERIAL PRIMARY KEY,
    source_id VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL,
    chunk_type VARCHAR(20) NOT NULL,
    text TEXT NOT NULL,
    embedding JSONB NOT NULL,
    metadata JSONB NOT NULL,
    indexed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE rag_edges (
    id SERIAL PRIMARY KEY,
    source_id INTEGER REFERENCES rag_chunks(id) ON DELETE CASCADE,
    target_id INTEGER REFERENCES rag_chunks(id) ON DELETE CASCADE,
    edge_type VARCHAR(50) NOT NULL,
    weight FLOAT NOT NULL,
    UNIQUE(source_id, target_id, edge_type)
);

CREATE INDEX ON rag_chunks USING gin (metadata);
CREATE INDEX ON rag_chunks USING gin (to_tsvector('english', text));
CREATE INDEX ON rag_edges (source_id);
CREATE INDEX ON rag_edges (target_id);
