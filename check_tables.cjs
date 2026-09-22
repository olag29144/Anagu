const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  "https://qtpieoxlmexisypbifoi.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function main() {
  const tables = ["parcels","applications","audit_trail","land_titles","mqtt_events","user_roles"];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select("id").limit(1);
    if (error) {
      console.log(`${t}: ${error.code} - ${error.message.substring(0,60)}`);
    } else {
      console.log(`${t}: EXISTS (${data.length} rows sampled)`);
    }
  }
}
main();
