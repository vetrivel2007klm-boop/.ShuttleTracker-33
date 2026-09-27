require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function runSeed() {
  if (!process.env.DATABASE_URL && !process.env.PGDATABASE) {
    console.log('No DATABASE_URL or PGDATABASE specified in .env. Skipping Postgres seeding (Embedded store is already loaded with demo data).');
    process.exit(0);
  }

  const isRemoteCloud =
    process.env.DATABASE_URL &&
    !process.env.DATABASE_URL.includes('localhost') &&
    !process.env.DATABASE_URL.includes('127.0.0.1');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    user: process.env.PGUSER,
    host: process.env.PGHOST || 'localhost',
    database: process.env.PGDATABASE,
    password: process.env.PGPASSWORD,
    port: process.env.PGPORT || 5432,
    ssl: isRemoteCloud || process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('Connecting to PostgreSQL...');
    const client = await pool.connect();

    console.log('Applying Schema...');
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    await client.query(schemaSql);
    console.log('Schema applied successfully.');

    console.log('Applying Seeds...');
    const seedsSql = fs.readFileSync(path.join(__dirname, 'seeds.sql'), 'utf-8');
    await client.query(seedsSql);
    console.log('Seeds applied successfully.');

    client.release();
    await pool.end();
    console.log('Done!');
    process.exit(0);
  } catch (err) {
    console.error('Failed to run seed on PostgreSQL:', err.message);
    process.exit(1);
  }
}

runSeed();
