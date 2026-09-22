const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const client = new Client({
  host: "aws-0-ap-southeast-1.pooler.supabase.com",
  port: 6543,
  database: "postgres",
  user: "postgres.qtpieoxlmexisypbifoi",
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

const root = "C:/Users/Ola Gabriel/Anagu";

const migrations = [
  { name: "001_spatial_schema", file: `${root}/backend/src/spatial/migrations/001_spatial_schema.sql` },
  { name: "002_audit_trail",    file: `${root}/backend/src/database/migrations/002_audit_trail.sql` },
  { name: "003_applications",   file: `${root}/backend/src/database/migrations/003_applications.sql` },
  { name: "004_land_titles",    file: `${root}/backend/src/database/migrations/004_land_titles.sql` },
  { name: "005_mqtt_events",    file: `${root}/backend/src/database/migrations/005_mqtt_events.sql` },
  { name: "006_user_roles",     file: `${root}/backend/src/database/migrations/006_user_roles.sql` },
];

async function runMigration(name, sql) {
  console.log(`\n--- Running ${name} ---`);
  try {
    await client.query(sql);
    console.log(`OK: ${name}`);
    return true;
  } catch(e) {
    console.error(`FAIL: ${name} => ${e.message}`);
    return false;
  }
}

async function main() {
  console.log("Connecting...");
  await client.connect();
  console.log("Connected!");

  const vRes = await client.query("SELECT version()");
  console.log("PG:", vRes.rows[0].version.substring(0, 60));

  let allOk = true;
  for (const m of migrations) {
    const sql = fs.readFileSync(m.file, "utf8");
    const ok = await runMigration(m.name, sql);
    if (!ok) allOk = false;
  }

  console.log("\n=== Verifying tables ===");
  const tables = ["parcels","applications","audit_trail","land_titles","mqtt_events","user_roles"];
  for (const t of tables) {
    try {
      const r = await client.query(`SELECT COUNT(*) FROM ${t}`);
      console.log(`  ${t}: EXISTS (${r.rows[0].count} rows)`);
    } catch(e) {
      console.log(`  ${t}: MISSING - ${e.message}`);
    }
  }

  console.log("\n=== Verifying RPC functions ===");
  const funcs = ["check_geometry_valid","check_parcel_overlap"];
  for (const fn of funcs) {
    try {
      const r = await client.query(
        `SELECT proname FROM pg_proc WHERE proname = $1`, [fn]
      );
      console.log(`  ${fn}: ${r.rowCount > 0 ? "EXISTS" : "MISSING"}`);
    } catch(e) {
      console.log(`  ${fn}: ERROR - ${e.message}`);
    }
  }

  await client.end();
  console.log(allOk ? "\nAll migrations completed successfully!" : "\nSome migrations had errors.");
}

main().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
