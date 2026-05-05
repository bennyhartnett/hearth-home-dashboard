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
const indexBuild = index.match(/<meta name="hearth-build" content="([^"]+)">/)?.[1];
const cssBuild = index.match(/styles\.css\?v=(\d+)/)?.[1];
const scriptBuild = index.match(/app\.js\?v=(\d+)/)?.[1];

assert(appBuild, "Missing BUILD_VERSION in app.js.");
assert(indexBuild, "Missing hearth-build marker in index.html.");
assert(appBuild === indexBuild, `BUILD_VERSION ${appBuild} does not match hearth-build ${indexBuild}.`);
assert(indexBuild === cssBuild, `hearth-build ${indexBuild} does not match styles.css?v=${cssBuild}.`);
assert(indexBuild === scriptBuild, `hearth-build ${indexBuild} does not match app.js?v=${scriptBuild}.`);

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
