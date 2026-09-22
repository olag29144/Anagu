const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  "https://qtpieoxlmexisypbifoi.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function main() {
  // Test if we can query existing tables
  const { data, error } = await supabase.from("user_roles").select("count(*)").limit(1);
  if (error) {
    console.log("user_roles table status:", error.code, error.message);
  } else {
    console.log("user_roles exists:", JSON.stringify(data));
  }

  // Try a different approach: check if parcels table exists
  const { data: d2, error: e2 } = await supabase.from("parcels").select("count(*)").limit(1);
  if (e2) {
    console.log("parcels table status:", e2.code, e2.message);
  } else {
    console.log("parcels exists:", JSON.stringify(d2));
  }
}
main();
