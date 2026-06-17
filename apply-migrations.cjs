const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const migrationsDir = path.join(__dirname, "supabase", "migrations");

const client = new Client({
  host: "aws-0-ap-northeast-1.pooler.supabase.com",
  port: 6543,
  database: "postgres",
  user: "postgres.gyidknazegcuicmoldjh",
  password: "Pratik5505I",
  ssl: { rejectUnauthorized: false },
});

const migrations = [
  "20260606101832_c7ad573f-005b-40de-b73a-deab0de6a948.sql",
  "20260606101853_718fb10a-efd9-4999-940b-d2c9eedd2653.sql",
  "20260606103059_e81499b6-1d2c-4553-9bb7-09ad5edf288d.sql",
  "20260611153006_6d7e3a6a-e6ba-44f0-bed0-f7a1d3519d95.sql",
];

async function run() {
  console.log("Connecting to database...");
  await client.connect();
  console.log("Connected!\n");

  for (const file of migrations) {
    const filePath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(filePath, "utf8");
    console.log(`Running migration: ${file}...`);
    try {
      await client.query(sql);
      console.log(`  ✅ ${file} applied successfully.\n`);
    } catch (err) {
      console.error(`  ❌ ${file} FAILED: ${err.message}\n`);
    }
  }

  await client.end();
  console.log("Done! All migrations applied.");
}

run().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});
