import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const svg = fs.readFileSync(path.join(root, "assets", "logo.svg"));
const png = new Resvg(svg, { fitTo: { mode: "width", value: 1024 } }).render().asPng();

for (const name of ["icon.png", "android-icon-foreground.png", "favicon.png"]) {
  fs.writeFileSync(path.join(root, "assets", name), png);
}

console.log("Exported assets/logo.svg to icon PNGs");
