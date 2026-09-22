const { Client } = require("pg");

// Supabase pooler: the username for the pooler MUST include the project ref
// but the DNS lookup error is because the client is treating "user@host" format incorrectly.
// The correct pg config is: user = "postgres.qtpieoxlmexisypbifoi" (not a hostname)
// The ENOTFOUND error "tenant/user postgres.qtpieoxlmexisypbifoi not found" 
// is actually from the POOLER server (not DNS) telling us the project ref is wrong.
// This could mean the pooler region is wrong OR the project uses a different pooler format.

// Let me try all AWS regions for the pooler
const regions = [
  "ap-southeast-1","ap-southeast-2","ap-northeast-1","ap-northeast-2",
  "ap-south-1","us-east-1","us-east-2","us-west-1","us-west-2",
  "eu-west-1","eu-west-2","eu-west-3","eu-central-1","eu-north-1",
  "ca-central-1","sa-east-1","af-south-1","me-south-1"
];

(async() => {
  for (const region of regions) {
    const poolerHost = `aws-0-${region}.pooler.supabase.com`;
    const c = new Client({
      host: poolerHost,
      port: 6543,
      database: "postgres",
      user: "postgres.qtpieoxlmexisypbifoi",
      password: process.env.SUPABASE_DB_PASSWORD,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000
    });
    try {
      await c.connect();
      const r = await c.query("SELECT current_user");
      console.log(`SUCCESS region=${region} user=${r.rows[0].current_user}`);
      await c.end();
      return;
    } catch(e) {
      const msg = e.message.substring(0,60);
      if (!msg.includes("ENOTFOUND") && !msg.includes("ECONNREFUSED")) {
        // Different error = pooler found but auth/tenant issue
        console.log(`DIFF ERROR region=${region}: ${msg}`);
      }
      try { await c.end(); } catch(_) {}
    }
  }
  console.log("No working region found");
})();
