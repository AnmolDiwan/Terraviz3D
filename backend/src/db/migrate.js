import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function runMigrations() {
    try {
        const sqlPath = path.join(__dirname, 'migrations', '001_rag_schema.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');
        
        console.log('Running migrations...');
        await db.query(sql);
        console.log('Migrations completed successfully.');
    } catch (error) {
        console.error('Error running migrations:', error);
        throw error;
    } finally {
        await db.end();
    }
}

// Run migrations if file is executed directly
if (process.argv[1] && process.argv[1] === __filename) {
    runMigrations().catch(err => {
        console.error('Migration script failed:', err);
        process.exit(1);
    });
}
