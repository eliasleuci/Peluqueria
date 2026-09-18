import { readFileSync } from 'fs';
import { Client } from 'pg';

const file = process.argv[2];
if (!file) {
  console.error('Uso: node scripts/run-sql.mjs <archivo.sql>');
  process.exit(1);
}

const envFile = readFileSync(new URL('../.env.local', import.meta.url), 'utf-8');
const dbUrlLine = envFile.split('\n').find((l) => l.startsWith('DATABASE_URL='));
const databaseUrl = dbUrlLine.slice('DATABASE_URL='.length).trim();

const sql = readFileSync(file, 'utf-8');

const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query(sql);
  console.log(`OK: ${file}`);
} catch (err) {
  console.error(`FALLÓ: ${file}`);
  console.error(err.message);
  process.exit(1);
} finally {
  await client.end();
}
