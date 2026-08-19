import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assets = path.join(root, "assets");
const logoPath = path.join(assets, "logo.svg");

/** Keep artwork inside Android adaptive-icon safe zone (~66% center). */
const CANVAS = 1024;
const LOGO_SCALE = 0.56;
const LOGO_SIZE = CANVAS * LOGO_SCALE;
const LOGO_OFFSET = (CANVAS - LOGO_SIZE) / 2;
const BRAND_GREEN = "#0d4d0d";

const logoDataUri = `data:image/svg+xml;base64,${fs
  .readFileSync(logoPath)
  .toString("base64")}`;

function renderCanvas({ background }) {
  const bgRect = background
    ? `<rect width="${CANVAS}" height="${CANVAS}" fill="${background}"/>`
    : "";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS}" height="${CANVAS}" viewBox="0 0 ${CANVAS} ${CANVAS}">
${bgRect}
<image href="${logoDataUri}" x="${LOGO_OFFSET}" y="${LOGO_OFFSET}" width="${LOGO_SIZE}" height="${LOGO_SIZE}" preserveAspectRatio="xMidYMid meet"/>
</svg>`;

  return new Resvg(svg, {
    fitTo: { mode: "width", value: CANVAS },
  })
    .render()
    .asPng();
}

const foregroundPng = renderCanvas({ background: null });
const iconPng = renderCanvas({ background: BRAND_GREEN });

fs.writeFileSync(path.join(assets, "android-icon-foreground.png"), foregroundPng);
fs.writeFileSync(path.join(assets, "icon.png"), iconPng);
fs.writeFileSync(path.join(assets, "favicon.png"), iconPng);

console.log(
  `Exported launcher icons (${Math.round(LOGO_SCALE * 100)}% logo, ${Math.round(LOGO_OFFSET)}px padding, bg ${BRAND_GREEN})`,
);
