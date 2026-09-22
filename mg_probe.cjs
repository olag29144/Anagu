const { Client } = require("pg");

const configs = [
  {
    label: "Direct IPv4 forced",
    host: "db.qtpieoxlmexisypbifoi.supabase.co",
    port: 5432,
    database: "postgres",
    user: "postgres",
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    family: 4
  },
  {
    label: "Transaction pooler 6543",
    host: "aws-0-eu-west-2.pooler.supabase.com",
    port: 6543,
    database: "postgres",
    user: "postgres.qtpieoxlmexisypbifoi",
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  },
  {
    label: "Session pooler 5432",
    host: "aws-0-eu-west-2.pooler.supabase.com",
    port: 5432,
    database: "postgres",
    user: "postgres.qtpieoxlmexisypbifoi",
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  },
  {
    label: "EU-central pooler 6543",
    host: "aws-0-eu-central-1.pooler.supabase.com",
    port: 6543,
    database: "postgres",
    user: "postgres.qtpieoxlmexisypbifoi",
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  },
  {
    label: "US-east pooler 6543",
    host: "aws-0-us-east-1.pooler.supabase.com",
    port: 6543,
    database: "postgres",
    user: "postgres.qtpieoxlmexisypbifoi",
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  }
];

async function tryOne(cfg) {
  const { label, ...opts } = cfg;
  const c = new Client(opts);
  c.connect((err) => {
    if (err) { console.log(`FAIL [${label}]: ${err.message}`); return; }
    c.query("SELECT current_user", (e2, r) => {
      if (e2) { console.log(`FAIL query [${label}]: ${e2.message}`); }
      else { console.log(`SUCCESS [${label}]: user=${r.rows[0].current_user}`); }
      c.end();
    });
  });
}

for (const cfg of configs) tryOne(cfg);
