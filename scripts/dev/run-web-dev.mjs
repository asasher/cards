import { runCommand } from "./shared.mjs";
import { getGatewayHost, getGatewayPort, resolveDevAppPort } from "./shared.mjs";

const appPort = await resolveDevAppPort();
const gatewayHost = getGatewayHost();
const gatewayPort = getGatewayPort();
const gatewayProtocol = process.env.DEV_GATEWAY_PROTOCOL || "http";

process.env.DEV_APP_PORT = String(appPort);
process.env.DEV_GATEWAY_HOST = gatewayHost;
process.env.DEV_GATEWAY_PORT = String(gatewayPort);
process.env.DEV_GATEWAY_PROTOCOL = gatewayProtocol;

console.log(`[dev] Stable URL: ${gatewayProtocol}://${gatewayHost}:${gatewayPort}`);
console.log(`[dev] Internal app URL: http://127.0.0.1:${appPort}`);

runCommand("bun", ["run", "route:generate"], {
  env: process.env,
});

runCommand("vite", ["dev", "--host", "0.0.0.0", "--port", String(appPort), "--strictPort"], {
  env: process.env,
});
