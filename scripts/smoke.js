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
const mapCars = read("map-cars.svg");
const styles = read("styles.css");

const appBuild = app.match(/const BUILD_VERSION = "([^"]+)"/)?.[1];
const indexBuild = index.match(/<meta name="custom-display-build" content="([^"]+)">/)?.[1];
const cssBuild = index.match(/styles\.css\?v=(\d+)/)?.[1];
const scriptBuild = index.match(/app\.js\?v=(\d+)/)?.[1];

assert(appBuild, "Missing BUILD_VERSION in app.js.");
assert(indexBuild, "Missing custom-display-build marker in index.html.");
assert(appBuild === indexBuild, `BUILD_VERSION ${appBuild} does not match custom-display-build ${indexBuild}.`);
assert(indexBuild === cssBuild, `custom-display-build ${indexBuild} does not match styles.css?v=${cssBuild}.`);
assert(indexBuild === scriptBuild, `custom-display-build ${indexBuild} does not match app.js?v=${scriptBuild}.`);
assert(index.includes('data-section="metro" hidden'), "Metro section must stay hidden.");
assert(index.includes('data-section="open-nearby" hidden'), "Open Nearby section must stay hidden.");
assert(!index.includes("openingh.openstreetmap.de"), "Hidden Open Nearby section must not load the broken opening-hours parser.");
assert(!app.match(/\bupdateMetro\(\)\.catch/), "Hidden Metro section must not refresh in the background.");
assert(!app.match(/\bupdateRestaurants\(currentLocation\)\.catch/), "Hidden Open Nearby section must not refresh in the background.");
assert(!app.includes("traffic.arcgis.com"), "The map must not depend on the ArcGIS traffic API.");
assert(!app.includes("trafficKey"), "The map must not request or store a traffic API key.");
assert(!app.includes("tile.openstreetmap.org"), "The map must not request OpenStreetMap tiles.");
assert(!index.includes("leaflet"), "The static map must not load Leaflet assets.");
assert(fs.existsSync(path.join(root, "map-fallback.png")), "Missing bundled map fallback image.");
assert(fs.existsSync(path.join(root, "map-cars.svg")), "Missing animated map car overlay.");
assert(index.includes('id="mapTrafficLayer"'), "Map must include the live traffic overlay host.");
assert(app.includes('./map-cars.svg?v=${BUILD_VERSION}'), "Animated map car overlay must use the current build version.");
assert((mapCars.match(/<animateMotion\b/g) || []).length >= 18, "Map must animate prevalent traffic along road paths.");
assert(mapCars.includes('repeatCount="indefinite"'), "Map car animations must loop continuously.");
assert(mapCars.includes("#0A84FF"), "Map cars must use electric blue.");
const carLayer = mapCars.match(/<g filter="url\(#car-shadow\)">([\s\S]*?)<\/g>\s*<g class="map-home-marker"/)?.[1] || "";
assert(carLayer && !/#ffffff|#DFF1FF|#031528/i.test(carLayer), "Map cars must be electric blue with no white or dark details.");
const carDurations = [...mapCars.matchAll(/data-traffic-rank="(\d+)" data-base-duration="([\d.]+)"/g)];
const durationsByRoute = new Map();
carDurations.forEach(([, rankText, duration]) => {
  const route = (Number(rankText) - 1) % 7;
  if (!durationsByRoute.has(route)) durationsByRoute.set(route, new Set());
  durationsByRoute.get(route).add(duration);
});
assert([...durationsByRoute.values()].every((durations) => durations.size === 1), "Cars sharing a road must keep the same speed.");
assert(mapCars.includes('class="map-home-marker"'), "Map must use a home icon at the address.");
assert(!mapCars.includes("923 N DANIEL"), "Map overlay must not show address text.");
assert(!styles.includes(".map-panel::after"), "Map must not show a corner label or credit.");
assert(index.includes("OpenStreetMap contributors"), "OpenStreetMap attribution must remain available in Settings.");
assert(app.includes("VDOT_TRAFFIC_TOKEN_URL"), "Map must load current VDOT traffic data.");
assert(app.includes("MAP_TRAFFIC_REFRESH_INTERVAL_MS"), "Map traffic must refresh on a schedule.");
assert(app.includes("trafficTileUrl"), "Map must build a live traffic-speed tile request.");
assert(app.includes("preventMapCarOverlaps"), "Map must suppress cars when their bounds would overlap.");
assert(index.includes('role="button"') && index.includes('aria-pressed="false"'), "Map must expose its inversion control.");
assert(styles.includes('[data-map-inverted="true"]::before'), "Map must invert only its black-and-white base layer.");

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
