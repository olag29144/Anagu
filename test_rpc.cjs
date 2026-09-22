const https = require("https");

const SUPABASE_URL = "https://qtpieoxlmexisypbifoi.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = "sb_publishable_M8832lTcVJciiM7DGidQaA_8k76KAwV";

function post(path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const url = new URL(SUPABASE_URL + path);
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
        "User-Agent": "AnaguMigrationRunner/1.0",
        "apikey": SERVICE_KEY,
        "Authorization": `Bearer ${SERVICE_KEY}`,
        ...headers
      }
    };
    const req = https.request(opts, (res) => {
      let buf = "";
      res.on("data", d => buf += d);
      res.on("end", () => {
        resolve({ status: res.statusCode, body: buf });
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  // Test the RPC endpoint
  const r = await post("/rest/v1/rpc/check_geometry_valid", { wkt: "SRID=4326;POLYGON((0 0,1 0,1 1,0 1,0 0))" });
  console.log("check_geometry_valid status:", r.status, r.body.substring(0, 100));
  
  // Try calling a non-existent function to see what error format we get
  const r2 = await post("/rest/v1/rpc/nonexistent_fn", {});
  console.log("nonexistent_fn status:", r2.status, r2.body.substring(0, 100));
}
main().catch(e => console.error(e.message));
