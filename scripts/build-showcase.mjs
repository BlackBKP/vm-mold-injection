import { cp, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const source = path.join(root, "vm-mold-injection-web", "wwwroot");
const output = path.join(root, "dist");

// The generated directory is always the repository's dist folder.
if (path.dirname(output) !== root || path.basename(output) !== "dist") {
  throw new Error("Unexpected showcase output path");
}
await mkdir(output, { recursive: true });
for (const entry of await readdir(output)) {
  await rm(path.join(output, entry), { recursive: true, force: true });
}
await cp(source, output, { recursive: true });
await writeFile(path.join(output, "dashboard-config.json"), JSON.stringify({ mode: "demo" }, null, 2) + "\n");
console.log("Showcase built in dist with simulated data for six machines.");
