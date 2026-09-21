export async function buildGraphEdges(db) {
  try {
    // Edge 1: same_region
    await db.query(`
      INSERT INTO rag_edges (source_id, target_id, edge_type, weight)
      SELECT a.id, b.id, 'same_region', 1.0
      FROM rag_chunks a
      JOIN rag_chunks b 
        ON a.metadata->>'region' = b.metadata->>'region'
        AND a.id <> b.id
      WHERE a.chunk_type = 'primary' AND b.chunk_type = 'primary'
      ON CONFLICT (source_id, target_id, edge_type) DO NOTHING;
    `);

    // Edge 2: temporal_cluster
    await db.query(`
      INSERT INTO rag_edges (source_id, target_id, edge_type, weight)
      SELECT 
        a.id, 
        b.id, 
        'temporal_cluster', 
        1.0 - (ABS(EXTRACT(EPOCH FROM ((a.metadata->>'timestamp')::TIMESTAMPTZ - (b.metadata->>'timestamp')::TIMESTAMPTZ))) / 604800.0)
      FROM rag_chunks a
      JOIN rag_chunks b 
        ON a.id <> b.id
      WHERE a.chunk_type = 'primary' AND b.chunk_type = 'primary'
        AND ABS(EXTRACT(EPOCH FROM ((a.metadata->>'timestamp')::TIMESTAMPTZ - (b.metadata->>'timestamp')::TIMESTAMPTZ))) < 604800
      ON CONFLICT (source_id, target_id, edge_type) DO NOTHING;
    `);

    // Edge 3: magnitude_similar
    await db.query(`
      INSERT INTO rag_edges (source_id, target_id, edge_type, weight)
      SELECT 
        a.id, 
        b.id, 
        'magnitude_similar', 
        1.0 - (ABS((a.metadata->>'magnitude')::FLOAT - (b.metadata->>'magnitude')::FLOAT) / 0.5)
      FROM rag_chunks a
      JOIN rag_chunks b 
        ON a.id <> b.id
      WHERE a.chunk_type = 'primary' AND b.chunk_type = 'primary'
        AND ABS((a.metadata->>'magnitude')::FLOAT - (b.metadata->>'magnitude')::FLOAT) < 0.5
      ON CONFLICT (source_id, target_id, edge_type) DO NOTHING;
    `);

    const countRes = await db.query('SELECT COUNT(*) FROM rag_edges');
    console.log(`Total edges in graph: ${countRes.rows[0].count}`);
  } catch (error) {
    console.error('Error building graph edges:', error.message);
    throw error;
  }
}
