import { composeFilePath, getComposeProjectName, runCommand } from "./shared.mjs";

const composeProjectName = getComposeProjectName();

runCommand("docker", [
  "compose",
  "-p",
  composeProjectName,
  "-f",
  composeFilePath,
  "logs",
  "-f",
  "postgres",
]);
