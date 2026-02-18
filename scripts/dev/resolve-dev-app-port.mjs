import { resolveDevAppPort } from "./shared.mjs";

const port = await resolveDevAppPort();
process.stdout.write(`${port}\n`);
