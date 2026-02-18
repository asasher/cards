import { promises as fs } from "node:fs";
import { composeFilePath, dbPortFilePath, envFilePath } from "./shared.mjs";
import { getComposeProjectName, getDbHost, getProjectSlug } from "./shared.mjs";
import { parseEnvText, readEnvText, runCommand, runCommandCapture, upsertEnvValues } from "./shared.mjs";

const composeProjectName = getComposeProjectName();
const composeBaseArgs = ["compose", "-p", composeProjectName, "-f", composeFilePath];

const waitStartResult = runCommandCapture("docker", [...composeBaseArgs, "up", "-d", "--wait", "postgres"], {
  encoding: "utf8",
});

if (waitStartResult.status !== 0) {
  console.log("[db-up] Falling back to 'docker compose up -d' (no --wait).");
  runCommand("docker", [...composeBaseArgs, "up", "-d", "postgres"]);
} else {
  process.stdout.write(waitStartResult.stdout);
  process.stderr.write(waitStartResult.stderr);
}

const portResult = runCommandCapture("docker", [...composeBaseArgs, "port", "postgres", "5432"], {
  encoding: "utf8",
});

if (portResult.status !== 0) {
  process.stderr.write(portResult.stderr);
  process.exit(portResult.status ?? 1);
}

const portLine = portResult.stdout.trim().split(/\r?\n/).pop() || "";
const mappedPort = Number.parseInt((portLine.match(/:(\d+)$/) || [])[1] || "", 10);

if (!Number.isInteger(mappedPort) || mappedPort < 1 || mappedPort > 65535) {
  throw new Error(`Unable to read mapped postgres host port from: '${portLine}'`);
}

const envText = await readEnvText();
const envValues = parseEnvText(envText);
const dbName = process.env.POSTGRES_DB || envValues.POSTGRES_DB || getProjectSlug();
const dbUser = process.env.POSTGRES_USER || envValues.POSTGRES_USER || "postgres";
const dbPassword = process.env.POSTGRES_PASSWORD || envValues.POSTGRES_PASSWORD || "postgres";
const dbHost = getDbHost();
const databaseUrl = `postgres://${dbUser}:${dbPassword}@${dbHost}:${mappedPort}/${dbName}`;

await upsertEnvValues({
  POSTGRES_DB: dbName,
  POSTGRES_USER: dbUser,
  POSTGRES_PASSWORD: dbPassword,
  POSTGRES_PORT: String(mappedPort),
  DATABASE_URL: databaseUrl,
});

await fs.writeFile(dbPortFilePath, `${mappedPort}\n`, "utf8");

console.log(`[db-up] Project: ${composeProjectName}`);
console.log(`[db-up] Host endpoint: ${dbHost}:${mappedPort}`);
console.log(`[db-up] Updated ${envFilePath}`);
