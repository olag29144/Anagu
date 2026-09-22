const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  "https://qtpieoxlmexisypbifoi.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function main() {
  // Try calling exec_sql RPC if it exists
  const { data, error } = await supabase.rpc("exec_sql", { sql: "SELECT 1 as test" });
  console.log("exec_sql:", error ? `${error.code}: ${error.message}` : JSON.stringify(data));

  // Try query RPC
  const { data: d2, error: e2 } = await supabase.rpc("query", { query: "SELECT 1" });
  console.log("query rpc:", e2 ? `${e2.code}: ${e2.message}` : JSON.stringify(d2));
  
  // Try the pg_query approach
  const { data: d3, error: e3 } = await supabase.rpc("pg_query", { query_text: "SELECT 1" });
  console.log("pg_query:", e3 ? `${e3.code}: ${e3.message}` : JSON.stringify(d3));
}
main();
