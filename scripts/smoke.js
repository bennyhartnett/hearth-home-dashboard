const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const appPath = path.join(root, "app.js");
const indexPath = path.join(root, "index.html");

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

execFileSync(process.execPath, ["--check", appPath], { stdio: "pipe" });

const app = read("app.js");
const index = read("index.html");

const appBuild = app.match(/const BUILD_VERSION = "([^"]+)"/)?.[1];
const indexBuild = index.match(/<meta name="custom-display-build" content="([^"]+)">/)?.[1];
const cssBuild = index.match(/styles\.css\?v=(\d+)/)?.[1];
const scriptBuild = index.match(/app\.js\?v=(\d+)/)?.[1];

assert(appBuild, "Missing BUILD_VERSION in app.js.");
assert(indexBuild, "Missing custom-display-build marker in index.html.");
assert(appBuild === indexBuild, `BUILD_VERSION ${appBuild} does not match custom-display-build ${indexBuild}.`);
assert(indexBuild === cssBuild, `custom-display-build ${indexBuild} does not match styles.css?v=${cssBuild}.`);
assert(indexBuild === scriptBuild, `custom-display-build ${indexBuild} does not match app.js?v=${scriptBuild}.`);
assert(!app.includes("out center tags 120"), "Restaurant Overpass query still caps results at 120.");
assert(app.includes("out center tags;"), "Restaurant Overpass query should return the full radius result set.");
assert(app.includes("radiusMiles: RESTAURANT_RADIUS_MILES"), "Restaurant cache must record the query radius.");
assert(app.includes("WMATA_GUEST_API_KEY"), "Metro must retain the keyless guest-feed fallback.");
assert(!app.includes("Add a WMATA API key in settings to show live train arrivals."), "Metro should not block arrivals on a personal API key.");
assert(!app.includes("traffic.arcgis.com"), "The map must not depend on the ArcGIS traffic API.");
assert(!app.includes("trafficKey"), "The map must not request or store a traffic API key.");
assert(!app.includes("tile.openstreetmap.org"), "The map must not request OpenStreetMap tiles.");
assert(!index.includes("leaflet"), "The static map must not load Leaflet assets.");
assert(fs.existsSync(path.join(root, "map-fallback.png")), "Missing bundled map fallback image.");

[
  "Weather unavailable",
  "fetch failed",
  "Drive estimates unavailable",
  "Metro unavailable",
  "Mobility unavailable",
  "Restaurants unavailable",
  "Opening-hours parser unavailable"
].forEach((text) => {
  assert(!app.includes(text) && !index.includes(text), `Forbidden kiosk error text found: ${text}`);
});

const sceneFiles = [...app.matchAll(/"\.\/scenes\/([^"]+\.png)"/g)].map((match) => match[1]);
assert(sceneFiles.length > 0, "No scene photo references found.");
sceneFiles.forEach((fileName) => {
  assert(fs.existsSync(path.join(root, "scenes", fileName)), `Missing scene file: scenes/${fileName}`);
});

console.log(`Smoke checks passed for build ${indexBuild}.`);
