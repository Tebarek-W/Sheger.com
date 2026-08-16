import fs from "fs";
import path from "path";

const root = path.resolve(import.meta.dirname, "..");
const files = [
  path.join(root, "sheger-mobile/assets/logo.svg"),
  path.join(root, "sheger-admin/public/logo.svg"),
  path.join(root, "Logo.svg"),
];

const CANVAS_RECT =
  /M 0,0 c 418,0 836,0 1254,0 c 0,418 0,836 0,1254 c -418,0 -836,0 -1254,0 c 0,-418 0,-836 0,-1254 Z /g;

for (const file of files) {
  let svg = fs.readFileSync(file, "utf8");
  const before = svg.length;

  svg = svg.replace(
    /<rect x="0" y="0" width="1254" height="1254" fill="#fefefe"\/?>\n?/g,
    "",
  );

  svg = svg.replace(
    /(<path fill="#fefefe" stroke="#fefefe" stroke-width="0\.5" d=")M 0,0 c 418,0 836,0 1254,0 c 0,418 0,836 0,1254 c -418,0 -836,0 -1254,0 c 0,-418 0,-836 0,-1254 Z /g,
    "$1",
  );

  fs.writeFileSync(file, svg);
  console.log(`${path.relative(root, file)}: ${before} -> ${svg.length} bytes`);
}
