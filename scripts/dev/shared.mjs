import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const repoRoot = path.resolve(__dirname, "..", "..");
export const composeFilePath = path.join(repoRoot, "docker-compose.yml");
export const envFilePath = path.join(repoRoot, ".env");
export const envExamplePath = path.join(repoRoot, ".env.example");
export const appPortFilePath = path.join(repoRoot, ".dev-app-port");
export const dbPortFilePath = path.join(repoRoot, ".dev-db-port");

export function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-") || "project";
}

export function getProjectSlug() {
  const override = process.env.DEV_PROJECT_SLUG;
  if (override && override.trim().length > 0) {
    return slugify(override);
  }

  return slugify(path.basename(repoRoot));
}

export function getGatewayHost() {
  return process.env.DEV_APP_HOST || `app.${getProjectSlug()}.localhost`;
}

export function getDbHost() {
  return `db.${getProjectSlug()}.localhost`;
}

export function getGatewayPort() {
  const parsed = Number.parseInt(process.env.DEV_GATEWAY_PORT || "7600", 10);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error("DEV_GATEWAY_PORT must be a valid TCP port.");
  }

  return parsed;
}

export function getGatewayContainerName() {
  return process.env.DEV_GATEWAY_CONTAINER || `${getProjectSlug()}-dev-gateway`;
}

export function getComposeProjectName() {
  return process.env.COMPOSE_PROJECT_NAME || `${getProjectSlug()}-dev`;
}

export function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    ...options,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

export function runCommandCapture(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: "utf8",
    ...options,
  });
}

export async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(false);
    });

    server.once("listening", () => {
      server.close(() => resolve(true));
    });

    server.listen(port, "0.0.0.0");
  });
}

export async function allocateFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", reject);
    server.listen(0, "0.0.0.0", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Could not allocate a free port.")));
        return;
      }

      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

export async function resolveDevAppPort() {
  const explicit = process.env.DEV_APP_PORT;
  if (explicit) {
    const explicitPort = Number.parseInt(explicit, 10);
    if (!Number.isInteger(explicitPort) || explicitPort < 1 || explicitPort > 65535) {
      throw new Error("DEV_APP_PORT must be a valid TCP port.");
    }

    await fs.writeFile(appPortFilePath, `${explicitPort}\n`, "utf8");
    return explicitPort;
  }

  try {
    const fromFile = Number.parseInt((await fs.readFile(appPortFilePath, "utf8")).trim(), 10);
    if (Number.isInteger(fromFile) && fromFile > 0 && fromFile <= 65535) {
      const available = await isPortAvailable(fromFile);
      if (available) {
        return fromFile;
      }
    }
  } catch {
    // No tracked port yet.
  }

  const allocated = await allocateFreePort();
  await fs.writeFile(appPortFilePath, `${allocated}\n`, "utf8");

  return allocated;
}

export async function readEnvText() {
  try {
    return await fs.readFile(envFilePath, "utf8");
  } catch {
    try {
      return await fs.readFile(envExamplePath, "utf8");
    } catch {
      return "";
    }
  }
}

export function parseEnvText(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) {
      continue;
    }

    const equalsIndex = line.indexOf("=");
    if (equalsIndex < 0) {
      continue;
    }

    const key = line.slice(0, equalsIndex).trim();
    const value = line.slice(equalsIndex + 1).trim();

    if (key.length > 0) {
      values[key] = value;
    }
  }

  return values;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function upsertEnvValues(nextValues) {
  let text = await readEnvText();

  for (const [key, value] of Object.entries(nextValues)) {
    const pattern = new RegExp(`^${escapeRegExp(key)}=.*$`, "m");
    const line = `${key}=${value}`;

    if (pattern.test(text)) {
      text = text.replace(pattern, line);
    } else {
      if (text.length > 0 && !text.endsWith("\n")) {
        text += "\n";
      }
      text += `${line}\n`;
    }
  }

  await fs.writeFile(envFilePath, text, "utf8");
}
