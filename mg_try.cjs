const { Client } = require("pg");

const attempts = [
  // Transaction pooler with project ref in username
  { h: "aws-0-ap-southeast-1.pooler.supabase.com", p: 6543, u: "postgres.qtpieoxlmexisypbifoi" },
  // Session pooler 
  { h: "aws-0-ap-southeast-1.pooler.supabase.com", p: 5432, u: "postgres.qtpieoxlmexisypbifoi" },
  // Direct with IPv6 (the only IP that resolved)
  { h: "2a05:d018:48a:c900:61e2:9d86:17a8:79ab", p: 5432, u: "postgres" },
  // Standard postgres user no ref
  { h: "aws-0-ap-southeast-1.pooler.supabase.com", p: 6543, u: "postgres" },
  // Try the project ref without the dot
  { h: "aws-0-ap-southeast-1.pooler.supabase.com", p: 6543, u: "qtpieoxlmexisypbifoi" },
];

(async() => {
  for (const a of attempts) {
    const c = new Client({
      host: a.h, port: a.p, database: "postgres",
      user: a.u, password: process.env.SUPABASE_DB_PASSWORD,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000
    });
    try {
      await c.connect();
      const r = await c.query("SELECT current_user");
      console.log(`SUCCESS ${a.h}:${a.p} user=${a.u} => ${r.rows[0].current_user}`);
      await c.end();
      break;
    } catch(e) {
      console.log(`FAIL    ${a.h}:${a.p} user=${a.u} => ${e.message.substring(0,80)}`);
      try { await c.end(); } catch(_) {}
    }
  }
})();
