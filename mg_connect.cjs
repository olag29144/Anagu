const { Client } = require("pg");
const fs = require("fs");

const client = new Client({
  host: "db.qtpieoxlmexisypbifoi.supabase.co",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log("Connected to Supabase PostgreSQL");
  const res = await client.query("SELECT version()");
  console.log(res.rows[0].version.substring(0, 80));
  await client.end();
}
main().catch(e => { console.error("FAILED:", e.message); process.exit(1); });
