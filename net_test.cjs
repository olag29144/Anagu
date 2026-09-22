const net = require("net");
const ipv6 = "2a05:d018:48a:c900:61e2:9d86:17a8:79ab";
const port = 5432;

const sock = net.createConnection({ host: ipv6, port, family: 6 });
sock.setTimeout(10000);
sock.on("connect", () => {
  console.log("TCP CONNECTED to IPv6 DB port 5432!");
  sock.destroy();
});
sock.on("timeout", () => { console.log("TIMEOUT"); sock.destroy(); });
sock.on("error", (e) => console.log("ERROR:", e.message));
