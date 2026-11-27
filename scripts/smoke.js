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
assert(!app.includes("corsproxy.io") && !app.includes("CORS_PROXY_URL"), "Live dashboard feeds must not depend on a third-party CORS proxy.");
assert(app.includes("https://mds.bird.co/gbfs/arlingtonco/free_bike_status.json"), "Scooters must use Arlington's direct Bird GBFS feed.");
assert(!index.includes("leaflet"), "The static map must not load Leaflet assets.");
assert(fs.existsSync(path.join(root, "map-fallback.png")), "Missing bundled map fallback image.");
assert(fs.existsSync(path.join(root, "map-cars.svg")), "Missing animated map car overlay.");
assert(index.includes('id="mapBaseImage"') && index.includes('map-fallback.png?v=' + indexBuild), "Map must render its base as a versioned image element.");
assert(index.includes('id="mapTrafficLayer"'), "Map must include the live traffic overlay host.");
assert(app.includes('./map-cars.svg?v=${BUILD_VERSION}'), "Animated map car overlay must use the current build version.");
assert((mapCars.match(/class="map-car map-car-/g) || []).length >= 24, "Map must include demand-scaled traffic along connected roads.");
assert(!mapCars.includes("<animateMotion"), "Map cars must use collision-aware JavaScript motion instead of blinking SVG loops.");
assert(mapCars.includes('data-phase="') && mapCars.includes('data-route="'), "Map cars must preserve continuous route position data.");
assert(mapCars.includes('data-road-priority="') && mapCars.includes('data-lane-offset="'), "Map cars must carry intersection priority and lane metadata.");
assert(mapCars.includes("#0A84FF"), "Map cars must use electric blue.");
assert(mapCars.includes("#FF2D2D") && mapCars.includes("car-shadow-red"), "Map must support red cars on congested roads.");
assert(mapCars.includes("#FFD60A") && mapCars.includes("car-shadow-yellow"), "Map must support yellow cars on partially congested roads.");
const carLayer = mapCars.split("</defs>")[1]?.split('<g class="map-home-marker"')[0] || "";
assert(carLayer && !/#ffffff|#DFF1FF|#031528/i.test(carLayer), "Map cars must be electric blue with no white or dark details.");
const carDurations = [...mapCars.matchAll(/data-traffic-rank="\d+"[^>]*data-route="(\d+)"[^>]*data-base-duration="([\d.]+)"/g)];
const durationsByRoute = new Map();
carDurations.forEach(([, routeText, duration]) => {
  const route = Number(routeText);
  if (!durationsByRoute.has(route)) durationsByRoute.set(route, new Set());
  durationsByRoute.get(route).add(duration);
});
assert([...durationsByRoute.values()].every((durations) => durations.size === 1), "Cars sharing a road must keep the same speed.");
const connectedRoutes = [...mapCars.matchAll(/<path id="car-route-\d+" d="([^"]+)" data-direction="(forward|reverse)"/g)];
assert(connectedRoutes.length >= 6, "Map must include multiple connected directed road routes.");
connectedRoutes.forEach(([, pathData]) => {
  const points = [...pathData.matchAll(/(-?\d+),(-?\d+)/g)].map((match) => [Number(match[1]), Number(match[2])]);
  const outside = ([x, y]) => x <= -20 || x >= 2420 || y <= -20 || y >= 820;
  assert(points.length > 3 && outside(points[0]) && outside(points.at(-1)), "Connected car routes must enter and leave beyond the map edge.");
  assert(new Set(points.map((point) => point.join(","))).size === points.length, "Connected car routes must not double back through a previously visited road node.");
});
assert(mapCars.includes('class="map-home-marker"'), "Map must use a home icon at the address.");
assert(!mapCars.includes("923 N DANIEL"), "Map overlay must not show address text.");
assert(!styles.includes(".map-panel::after"), "Map must not show a corner label or credit.");
assert(index.includes("OpenStreetMap contributors"), "OpenStreetMap attribution must remain available in Settings.");
assert(app.includes("VDOT_TRAFFIC_TOKEN_URL"), "Map must load current VDOT traffic data.");
assert(app.includes("MAP_TRAFFIC_REFRESH_INTERVAL_MS"), "Map traffic must refresh on a schedule.");
assert(app.includes("trafficTileUrl"), "Map must build a live traffic-speed tile request.");
assert(app.includes("startMapCarAnimation"), "Map must use continuous collision-aware car motion.");
assert(app.includes("currentTrafficRouteStates"), "Map must derive yellow and red cars from live road-level traffic.");
assert(app.includes("trafficDemandCount"), "Traffic density must be independent from congestion color.");
assert(app.includes("stabilizeTrafficRouteStates"), "Traffic colors must be stabilized across consecutive readings.");
assert(app.includes("data-signal-phase"), "Intersections must use alternating right-of-way phases.");
assert(app.includes("collisionConflictsByPair") && app.includes("nearSharedConflict") && app.includes("MAP_CAR_COLLISION_DISTANCE"), "Crossing routes must reserve collision-free intersection space only near their shared junction.");
assert(app.includes("MAP_CAR_EMERGENCY_DISTANCE"), "Cars on overlapping road geometry must keep an emergency separation distance.");
assert(app.includes("MAP_CAR_SAME_ROUTE_DISTANCE"), "Cars following the same road must keep extra spacing through bends.");
assert(app.includes("MAP_CAR_FRAME_FALLBACK_MS") && app.includes("mapTrafficAnimationTimer"), "Map car motion must fall back to a timer when animation frames stall.");
assert(!app.includes("visibility = \"hidden\""), "Map cars must never disappear to avoid a collision.");
assert(app.includes("wantsActive") && app.includes("const offscreen"), "Traffic density changes must occur only beyond the map edge.");
assert(!read("scripts/render_map_options.py").includes("extend_route_offscreen"), "Car paths must never use artificial off-road extensions.");
assert(read("scripts/render_map_options.py").includes('tags.get("oneway"') && read("scripts/render_map_options.py").includes('tags.get("junction") == "roundabout"'), "Connected routes must honor OSM one-way and roundabout direction.");
assert(index.includes('role="button"') && index.includes('aria-pressed="false"'), "Map must expose its inversion control.");
assert(styles.includes('[data-map-inverted="true"] .map-base-image'), "Map must invert only its black-and-white base image.");

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
