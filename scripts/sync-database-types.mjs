import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "supabase", "types", "database.ts");
const targets = [
  join(root, "sheger-mobile", "lib", "types", "database.ts"),
  join(root, "sheger-admin", "lib", "types", "database.ts"),
];

const header = "// Keep in sync with supabase/types/database.ts\n// Run: npm run db:types (after supabase link) or npm run db:types:sync\n\n";
const body = readFileSync(source, "utf8").replace(/^\/\/ Keep in sync.*\n(\/\/ Run:.*\n)?/m, "");

for (const target of targets) {
  writeFileSync(target, header + body, "utf8");
  console.log(`Synced ${target}`);
}
