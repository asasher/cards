import { getGatewayContainerName, getGatewayHost, getGatewayPort, getProjectSlug } from "./shared.mjs";
import { resolveDevAppPort, runCommand, runCommandCapture } from "./shared.mjs";

function inspectContainer(containerName) {
  const inspectResult = runCommandCapture("docker", ["inspect", containerName]);

  if (inspectResult.status !== 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(inspectResult.stdout);
    return parsed[0] ?? null;
  } catch {
    return null;
  }
}

const slug = getProjectSlug();
const appPort = await resolveDevAppPort();
const gatewayPort = getGatewayPort();
const gatewayHost = getGatewayHost();
const containerName = getGatewayContainerName();
const expectedCommand = [
  "caddy",
  "reverse-proxy",
  "--from",
  ":7000",
  "--to",
  `host.docker.internal:${appPort}`,
];

const existing = inspectContainer(containerName);

if (existing) {
  const labels = existing.Config?.Labels ?? {};
  const hostBindings = existing.HostConfig?.PortBindings?.["7000/tcp"] ?? [];
  const boundPorts = hostBindings.map((binding) => binding.HostPort);
  const running = existing.State?.Running === true;
  const commandMatches = JSON.stringify(existing.Config?.Cmd ?? []) === JSON.stringify(expectedCommand);
  const labelsMatch =
    labels["dev.gateway.project"] === slug &&
    labels["dev.gateway.app-port"] === String(appPort) &&
    labels["dev.gateway.gateway-port"] === String(gatewayPort) &&
    labels["dev.gateway.host"] === gatewayHost;
  const portMatches = boundPorts.includes(String(gatewayPort));

  if (commandMatches && labelsMatch && portMatches) {
    if (!running) {
      runCommand("docker", ["start", containerName]);
    }

    console.log(`[gateway] Reusing ${containerName} at http://${gatewayHost}:${gatewayPort}`);
    process.exit(0);
  }

  runCommand("docker", ["rm", "-f", containerName]);
}

runCommand("docker", [
  "run",
  "-d",
  "--name",
  containerName,
  "--restart",
  "unless-stopped",
  "-p",
  `${gatewayPort}:7000`,
  "--label",
  `dev.gateway.project=${slug}`,
  "--label",
  `dev.gateway.app-port=${appPort}`,
  "--label",
  `dev.gateway.gateway-port=${gatewayPort}`,
  "--label",
  `dev.gateway.host=${gatewayHost}`,
  "caddy:2.8.4-alpine",
  ...expectedCommand,
]);

console.log(`[gateway] Ready at http://${gatewayHost}:${gatewayPort}`);
