import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const gatewayHost = process.env.DEV_GATEWAY_HOST;
const gatewayPort = Number.parseInt(process.env.DEV_GATEWAY_PORT || "", 10);
const appPort = Number.parseInt(process.env.DEV_APP_PORT || "", 10);
const gatewayProtocol = process.env.DEV_GATEWAY_PROTOCOL || "http";
const hmrProtocol: "ws" | "wss" = gatewayProtocol === "https" ? "wss" : "ws";

const allowedHosts = new Set<string>(["host.docker.internal", "localhost"]);
if (gatewayHost) {
  allowedHosts.add(gatewayHost);
}

const hmr =
  gatewayHost && Number.isInteger(gatewayPort)
    ? {
        host: gatewayHost,
        clientPort: gatewayPort,
        protocol: hmrProtocol,
      }
    : undefined;

const config = defineConfig({
  envDir: "../../",
  server: {
    host: "0.0.0.0",
    port: Number.isInteger(appPort) ? appPort : 3000,
    strictPort: true,
    allowedHosts: [...allowedHosts],
    hmr,
  },
  plugins: [
    devtools(),
    tsconfigPaths({ projects: ["./tsconfig.json"] }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
});

export default config;
