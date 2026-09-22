const { Client } = require("pg");
const fs = require("fs");
const path = require("path");

const client = new Client({
  host: "db.qtpieoxlmexisypbifoi.supabase.co",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: process.env.SUPABASE_SERVICE_ROLE_KEY,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    await client.connect();
    console.log("Connected to Supabase PostgreSQL");
    const res = await client.query("SELECT version()");
    console.log(res.rows[0].version.substring(0, 60));
    await client.end();
  } catch(e) {
    console.error("Connection failed:", e.message);
  }
}
main();
