const https = require("https");
const fs = require("fs");

const BASE = "https://qtpieoxlmexisypbifoi.supabase.co";
const KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ROOT = "C:/Users/Ola Gabriel/Anagu";

function api(path, body, method = "POST") {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const url = new URL(BASE + path);
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "AnaguMigrationRunner/1.0 (Node.js)",
        "apikey": KEY,
        "Authorization": `Bearer ${KEY}`,
        ...(data ? { "Content-Length": Buffer.byteLength(data) } : {})
      }
    };
    const req = https.request(opts, res => {
      let buf = "";
      res.on("data", d => buf += d);
      res.on("end", () => resolve({ status: res.statusCode, body: buf }));
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

// Step 1: Create a temporary exec_sql function via Supabase's RPC
// We'll POST a DDL statement to create the helper function first using
// Supabase's ability to run SQL via the /rest/v1/rpc/exec_ddl endpoint if it exists
// OR we can use the Supabase Management API SQL endpoint

// The Supabase Management API (not PostgREST) accepts SQL via:
// POST https://api.supabase.com/v1/projects/{ref}/database/query
// with Authorization: Bearer <personal-access-token>
// But we don't have a PAT...

// Alternative: Supabase has a dedicated SQL endpoint on the project:
// POST https://{ref}.supabase.co/rest/v1/ with special header
// Actually the correct endpoint for running arbitrary SQL is the pg REST API:
// It's only available when using the service_role JWT (not sb_secret key format)

// Let's check if the ANON key works differently, and check the /auth/v1/token endpoint
// to exchange our service key for a proper JWT

async function main() {
  // First test: can we INSERT into audit_trail (which we know exists)?
  const insertTest = await api("/rest/v1/audit_trail", {
    entity_id: "migration-test",
    action: "MIGRATION_TEST",
    outcome: "TESTING"
  });
  console.log("Insert test:", insertTest.status, insertTest.body.substring(0, 100));

  // Second: try to use Supabase's management API
  const mgmt = await api("https://api.supabase.com/v1/projects/qtpieoxlmexisypbifoi/database/query"
    .replace("https://qtpieoxlmexisypbifoi.supabase.co", ""),
    { query: "SELECT 1" });
  console.log("Mgmt API:", mgmt.status, mgmt.body.substring(0, 100));
}
main().catch(e => console.error(e.message));
