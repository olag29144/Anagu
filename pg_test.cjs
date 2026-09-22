const { Client } = require("pg");

// Try different connection approaches
const configs = [
  {
    name: "Direct (postgres user, service key as password)",
    host: "db.qtpieoxlmexisypbifoi.supabase.co",
    port: 5432,
    database: "postgres",
    user: "postgres",
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  },
  {
    name: "Pooler (service_role user)",
    host: "aws-0-eu-west-2.pooler.supabase.com",
    port: 6543,
    database: "postgres",
    user: "postgres.qtpieoxlmexisypbifoi",
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  },
  {
    name: "Session pooler",
    host: "aws-0-eu-west-2.pooler.supabase.com",
    port: 5432,
    database: "postgres",
    user: "postgres.qtpieoxlmexisypbifoi",
    password: process.env.SUPABASE_DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  }
];

async function tryConnect(config) {
  const { name, ...opts } = config;
  const client = new Client(opts);
  try {
    await client.connect();
    const res = await client.query("SELECT current_user, version()");
    console.log(`SUCCESS [${name}]: user=${res.rows[0].current_user}`);
    await client.end();
    return client;
  } catch(e) {
    console.log(`FAILED  [${name}]: ${e.message}`);
    return null;
  }
}

async function main() {
  for (const cfg of configs) {
    await tryConnect(cfg);
  }
}
main();
