const { Client } = require("pg");
const fs = require("fs");

const client = new Client({
  host: "db.qtpieoxlmexisypbifoi.supabase.co",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: "Candaf0709",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 30000
});

const migrations = [
  { name: "001_spatial_schema", path: "backend/src/spatial/migrations/001_spatial_schema.sql" },
  { name: "002_audit_trail", path: "backend/src/database/migrations/002_audit_trail.sql" },
  { name: "003_applications", path: "backend/src/database/migrations/003_applications.sql" },
  { name: "004_land_titles", path: "backend/src/database/migrations/004_land_titles.sql" },
  { name: "005_mqtt_events", path: "backend/src/database/migrations/005_mqtt_events.sql" },
  { name: "006_user_roles", path: "backend/src/database/migrations/006_user_roles.sql" }
];

async function main() {
  try {
    console.log("Connecting to Supabase PostgreSQL via IPv6...");
    await client.connect();
    console.log("Connected!\n");

    for (const m of migrations) {
      console.log(`Running ${m.name}...`);
      const sql = fs.readFileSync(`C:/Users/Ola Gabriel/Anagu/${m.path}`, "utf8");
      try {
        await client.query(sql);
        console.log(`✓ ${m.name} completed\n`);
      } catch (e) {
        console.error(`✗ ${m.name} failed: ${e.message}\n`);
      }
    }

    console.log("=== Verifying tables ===");
    const tables = ["parcels", "applications", "audit_trail", "land_titles", "mqtt_events", "user_roles"];
    for (const t of tables) {
      try {
        const r = await client.query(`SELECT COUNT(*) FROM ${t}`);
        console.log(`  ✓ ${t}: exists (${r.rows[0].count} rows)`);
      } catch (e) {
        console.log(`  ✗ ${t}: MISSING`);
      }
    }

    console.log("\n=== Verifying RPC functions ===");
    const funcs = ["check_geometry_valid", "persist_verified_parcel", "check_parcel_overlap"];
    for (const fn of funcs) {
      const r = await client.query(
        `SELECT proname FROM pg_proc WHERE proname = $1`, [fn]
      );
      console.log(`  ${r.rowCount > 0 ? '✓' : '✗'} ${fn}`);
    }

    await client.end();
    console.log("\nAll migrations completed!");
  } catch (e) {
    console.error("Fatal error:", e.message);
    process.exit(1);
  }
}
main();
