const WEATHER_CODES = {
  0: ["Clear", "clear"],
  1: ["Mostly clear", "clear"],
  2: ["Partly cloudy", "cloudy"],
  3: ["Cloudy", "cloudy"],
  45: ["Fog", "foggy"],
  48: ["Rime fog", "foggy"],
  51: ["Light drizzle", "rainy"],
  53: ["Drizzle", "rainy"],
  55: ["Heavy drizzle", "rainy"],
  61: ["Light rain", "rainy"],
  63: ["Rain", "rainy"],
  65: ["Heavy rain", "rainy"],
  71: ["Light snow", "snowy"],
  73: ["Snow", "snowy"],
  75: ["Heavy snow", "snowy"],
  80: ["Rain showers", "rainy"],
  81: ["Showers", "rainy"],
  82: ["Heavy showers", "rainy"],
  95: ["Thunderstorm", "storm"],
  96: ["Thunderstorm", "storm"],
  99: ["Thunderstorm", "storm"]
};

const MAP_STYLES = {
  dark: {
    label: "Dark",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap &copy; CARTO"
  },
  light: {
    label: "Light",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap &copy; CARTO"
  }
};

const DESTINATIONS = [
  { name: "McLean", lat: 38.9343, lon: -77.1775 },
  { name: "Tysons", lat: 38.9187, lon: -77.2311 },
  { name: "Navy Yard", lat: 38.8766, lon: -77.0051 }
];

const CLARENDON_STATION_CODE = "K02";
const RESTAURANT_RADIUS_MILES = 0.7;
const RESTAURANT_RADIUS_METERS = Math.round(RESTAURANT_RADIUS_MILES * 1609.344);
const STORAGE_KEY = "hearth-dashboard-settings-v2";
const CORS_PROXY_URL = "https://corsproxy.io/?";
const LIME_ARLINGTON_SCOOTERS_URL = "https://data.lime.bike/api/partners/v2/gbfs/arlington/free_bike_status";

const DEFAULT_SETTINGS = {
  locationLabel: "Current Location",
  themeMode: "auto",
  refreshMinutes: 5,
  mobilityRadiusMiles: 2,
  wmataKey: "",
  fallbackLat: "",
  fallbackLon: ""
};

let settings = loadSettings();
applySettingsFromUrl();
let currentLocation = null;
let refreshTimer = null;
let map = null;
let tileLayer = null;
let layers = {};
let activeTheme = "dark";
let wakeLock = null;
let driveRoutes = new Map();

const $ = (id) => document.getElementById(id);

function loadSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...DEFAULT_SETTINGS, ...stored };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(nextSettings) {
  settings = { ...DEFAULT_SETTINGS, ...nextSettings };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function applySettingsFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("saveLocalSettings") !== "1") return;

  const nextSettings = { ...settings };
  const allowedKeys = [
    "locationLabel",
    "themeMode",
    "refreshMinutes",
    "mobilityRadiusMiles",
    "fallbackLat",
    "fallbackLon",
    "wmataKey"
  ];

  allowedKeys.forEach((key) => {
    if (params.has(key)) nextSettings[key] = params.get(key).trim();
  });

  saveSettings(nextSettings);
  params.delete("saveLocalSettings");
  allowedKeys.forEach((key) => params.delete(key));

  const cleanQuery = params.toString();
  const cleanUrl = `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ""}${window.location.hash}`;
  window.history.replaceState(null, "", cleanUrl);
}

function setText(id, text) {
  const element = $(id);
  if (element) element.textContent = text;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function iconSvg(name) {
  const icons = {
    bike: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="17" r="3.2"></circle><circle cx="19" cy="17" r="3.2"></circle><path d="M8.5 17 12 9h3l4 8M12 9l-3.5 8h7M10 6h4M15 6l1.4 3"></path></svg>',
    calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v4M17 3v4M4 9h16M5 5h14v15H5z"></path></svg>',
    car: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16h14l-1.6-5.2A3 3 0 0 0 14.6 9H9.4a3 3 0 0 0-2.8 1.8L5 16ZM7 16v3M17 16v3M7 13h10"></path><circle cx="8" cy="18" r="1.4"></circle><circle cx="16" cy="18" r="1.4"></circle></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"></circle><path d="M12 7v5l3.5 2"></path></svg>',
    coffee: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h11v5a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V8ZM16 10h2.5a2.5 2.5 0 0 1 0 5H16M7 4v2M11 4v2M15 4v2"></path></svg>',
    food: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v8M4.5 3v5.5A2.5 2.5 0 0 0 7 11v10M9.5 3v5.5A2.5 2.5 0 0 1 7 11M17 3v18M14 3h3a3 3 0 0 1 3 3v5h-6V3Z"></path></svg>',
    drink: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4h12l-1 8a5 5 0 0 1-10 0L6 4ZM9 20h6M12 17v3M7 8h10"></path></svg>',
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 11 8-7 8 7M6 10v10h12V10M10 20v-6h4v6"></path></svg>',
    map: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18-5 2V6l5-2 6 2 5-2v14l-5 2-6-2ZM9 4v14M15 6v14"></path></svg>',
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-6.2 7-12A7 7 0 0 0 5 9c0 5.8 7 12 7 12Z"></path><circle cx="12" cy="9" r="2.5"></circle></svg>',
    sandwich: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 12 8-6 8 6v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5ZM4 12h16M8 15h2M13 15h3"></path></svg>',
    scooter: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18h8.5a3.5 3.5 0 0 0 3.5-3.5V4M12 7h7M5 18l5-9h3"></path><circle cx="5" cy="18" r="2"></circle><circle cx="19" cy="18" r="2"></circle></svg>',
    train: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h10a3 3 0 0 1 3 3v8a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V6a3 3 0 0 1 3-3ZM4 9h16M8 21l3-3M16 21l-3-3"></path><circle cx="8" cy="14" r="1"></circle><circle cx="16" cy="14" r="1"></circle></svg>'
  };
  return icons[name] || icons.pin;
}

function hydrateStaticIcons() {
  document.querySelectorAll(".section-icon[data-icon]").forEach((element) => {
    element.innerHTML = iconSvg(element.dataset.icon);
  });
}

function formatTime(date) {
  return new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" }).format(date);
}

function formatDate(date) {
  return new Intl.DateTimeFormat([], {
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(date);
}

function round(value) {
  return Number.isFinite(value) ? Math.round(value) : "--";
}

function miles(meters) {
  return meters / 1609.344;
}

function formatMiles(value) {
  return `${value.toFixed(value < 1 ? 2 : 1)} mi`;
}

function formatDuration(seconds) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
}

function formatRainTime(time) {
  const target = new Date(time);
  const diffMs = target.getTime() - Date.now();
  if (!Number.isFinite(diffMs) || diffMs < 0) return "now";
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 90) return `in ${Math.max(1, minutes)} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `in ${hours} hr`;
  const days = Math.floor(hours / 24);
  return `in ${days} day${days === 1 ? "" : "s"} at ${formatTime(target)}`;
}

function distanceMeters(a, b) {
  const radius = 6371000;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function weatherInfo(code) {
  return WEATHER_CODES[code] || ["Weather unavailable", "cloudy"];
}

function applyTheme(theme) {
  activeTheme = theme === "light" ? "light" : "dark";
  document.body.dataset.theme = activeTheme;
  document.documentElement.style.colorScheme = activeTheme;
  setMapStyle(activeTheme);
}

function applyThemeFromSun(daily) {
  if (settings.themeMode === "light" || settings.themeMode === "dark") {
    applyTheme(settings.themeMode);
    return;
  }

  const sunrise = daily?.sunrise?.[0] ? new Date(daily.sunrise[0]) : null;
  const sunset = daily?.sunset?.[0] ? new Date(daily.sunset[0]) : null;
  const now = new Date();
  if (sunrise && sunset) {
    applyTheme(now >= sunrise && now < sunset ? "light" : "dark");
    return;
  }

  const hour = now.getHours();
  applyTheme(hour >= 7 && hour < 19 ? "light" : "dark");
}

function updateClock() {
  const now = new Date();
  setText("clock", formatTime(now));
  setText("dateLine", formatDate(now));
}

function showNotice(message) {
  const notice = $("locationNotice");
  notice.textContent = message;
  notice.classList.add("visible");
}

function hideNotice() {
  $("locationNotice").classList.remove("visible");
}

function setEmpty(containerId, message) {
  const container = $(containerId);
  container.innerHTML = `<div class="empty-state">${message}</div>`;
}

function dataRow(title, meta, value) {
  return `
    <div class="data-row">
      <div>
        <strong>${escapeHtml(title)}</strong>
        <p class="meta">${escapeHtml(meta)}</p>
      </div>
      <div class="primary-value">${escapeHtml(value)}</div>
    </div>
  `;
}

function createDataButton(title, meta, value, iconName, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "data-row data-button";
  button.innerHTML = `
    <span class="row-icon" aria-hidden="true">${iconSvg(iconName)}</span>
    <span>
      <strong>${escapeHtml(title)}</strong>
      <span class="meta">${escapeHtml(meta)}</span>
    </span>
    <span class="primary-value">${escapeHtml(value)}</span>
  `;
  button.addEventListener("click", onClick);
  return button;
}

function initMap() {
  if (!window.L) {
    setText("mapStatus", "Map library unavailable");
    return;
  }

  map = L.map("map", {
    zoomControl: false,
    attributionControl: true
  }).setView([38.889, -77.05], 12);

  L.control.zoom({ position: "bottomright" }).addTo(map);
  layers = {
    user: L.layerGroup().addTo(map),
    restaurants: L.layerGroup().addTo(map),
    bikes: L.layerGroup().addTo(map),
    scooters: L.layerGroup().addTo(map),
    route: L.layerGroup().addTo(map)
  };

  setMapStyle(activeTheme);
  setTimeout(() => map.invalidateSize(), 250);
}

function setMapStyle(key) {
  if (!map) return;
  const style = MAP_STYLES[key === "light" ? "light" : "dark"];
  if (tileLayer) tileLayer.remove();
  tileLayer = L.tileLayer(style.url, {
    maxZoom: 19,
    attribution: style.attribution
  }).addTo(map);
  setTimeout(() => map.invalidateSize(), 100);
}

function markerIcon(type) {
  const size = type === "user" ? 38 : 32;
  return L.divIcon({
    html: `<div class="map-marker marker-${escapeHtml(type)}">${iconSvg(type)}</div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2]
  });
}

function updateUserMarker(location) {
  if (!map) return;
  layers.user.clearLayers();
  L.marker([location.lat, location.lon], { icon: markerIcon("user") })
    .bindPopup(location.source === "fallback" ? "Saved fallback location" : "Current location")
    .addTo(layers.user);
  map.invalidateSize();
  if ($("routeDetails")?.hidden !== false) map.setView([location.lat, location.lon], 15);
  setText(
    "mapStatus",
    location.source === "fallback"
      ? "Using local-only saved location"
      : `Location accuracy ${Math.round(location.accuracy)} m`
  );
}

function getFallbackLocation() {
  if (String(settings.fallbackLat).trim() === "" || String(settings.fallbackLon).trim() === "") return null;
  const lat = Number(settings.fallbackLat);
  const lon = Number(settings.fallbackLon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon, accuracy: 0, source: "fallback" };
}

function useFallbackLocation(reason = "Using the saved local-only location from this browser.", silent = false) {
  const fallback = getFallbackLocation();
  if (!fallback) return false;
  currentLocation = fallback;
  if (silent) {
    hideNotice();
  } else {
    showNotice(reason);
  }
  if (!map) initMap();
  updateUserMarker(currentLocation);
  refreshAll();
  return true;
}

function requestLocation(options = {}) {
  const forceBrowser = options.forceBrowser === true;
  if (!forceBrowser && useFallbackLocation("Using the saved local-only location from this browser.", true)) return;

  if (!navigator.geolocation) {
    if (useFallbackLocation("This browser does not expose geolocation. Using the saved local-only location from this browser.")) return;
    showNotice("This browser does not expose geolocation. Add fallback coordinates in settings to load local data.");
    return;
  }

  showNotice("Requesting browser location. Approve location access on the Hearth if prompted.");
  navigator.geolocation.getCurrentPosition(
    (position) => {
      currentLocation = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        accuracy: position.coords.accuracy || 0,
        source: "browser"
      };
      hideNotice();
      if (!map) initMap();
      updateUserMarker(currentLocation);
      refreshAll();
    },
    (error) => {
      if (useFallbackLocation(`Browser location unavailable: ${error.message}. Using the saved local-only location from this browser.`)) return;
      showNotice(`Location unavailable: ${error.message}. Tap Locate after enabling location permission.`);
      setText("weatherSummary", "Location required");
      setEmpty("driveList", "Location required for drive estimates.");
      setEmpty("mobilityList", "Location required for nearby bikes and scooters.");
      setEmpty("restaurantList", "Location required for open restaurants.");
    },
    {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 120000
    }
  );
}

function initializeLocation() {
  if (useFallbackLocation("Using the saved local-only location from this browser.", true)) return;
  requestLocation({ forceBrowser: true });
}

async function updateWeather(location) {
  setText("locationLabel", settings.locationLabel || "Current Location");

  const params = new URLSearchParams({
    latitude: String(location.lat),
    longitude: String(location.lon),
    timezone: "auto",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "weather_code",
      "wind_speed_10m",
      "is_day"
    ].join(","),
    hourly: "temperature_2m,weather_code,precipitation_probability,precipitation",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset"
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!response.ok) throw new Error(`Open-Meteo ${response.status}`);

  const data = await response.json();
  const current = data.current || {};
  const [summary, visual] = weatherInfo(current.weather_code);
  const daily = data.daily || {};
  const isDay = current.is_day !== 0;

  setText("currentTemp", round(current.temperature_2m));
  setText("weatherSummary", summary);
  setText("feelsLike", `${round(current.apparent_temperature)}°`);
  setText("humidity", `${round(current.relative_humidity_2m)}%`);
  setText("wind", `${round(current.wind_speed_10m)} mph`);
  setText("highLow", `${round(daily.temperature_2m_max?.[0])}° / ${round(daily.temperature_2m_min?.[0])}°`);
  setText("rainSoon", findNextRain(data.hourly || {}));
  setText("updatedLine", `Updated ${formatTime(new Date())}`);

  applyThemeFromSun(daily);
  $("skyScene").className = `sky-scene ${isDay ? "day" : "night"} ${visual}`;
  renderHourly(data.hourly || {});
  renderDaily(daily);
}

function findNextRain(hourly) {
  const times = hourly.time || [];
  const probabilities = hourly.precipitation_probability || [];
  const amounts = hourly.precipitation || [];
  const now = Date.now();
  const startIndex = Math.max(0, times.findIndex((time) => new Date(time).getTime() >= now - 30 * 60000));

  for (let index = startIndex; index < times.length; index += 1) {
    const probability = Number(probabilities[index] || 0);
    const amount = Number(amounts[index] || 0);
    if (probability > 0 || amount > 0) {
      const label = probability > 0 ? `${probability}%` : "trace";
      return `${label} ${formatRainTime(times[index])}`;
    }
  }

  return "No rain in 7 days";
}

function renderHourly(hourly) {
  const container = $("hourlyStrip");
  container.innerHTML = "";

  const now = Date.now();
  const times = hourly.time || [];
  const startIndex = Math.max(0, times.findIndex((time) => new Date(time).getTime() > now));
  const nextHours = times.slice(startIndex, startIndex + 6);

  if (!nextHours.length) {
    setEmpty("hourlyStrip", "No hourly forecast returned.");
    return;
  }

  nextHours.forEach((time, offset) => {
    const index = startIndex + offset;
    const [, visual] = weatherInfo(hourly.weather_code?.[index]);
    const article = document.createElement("article");
    article.className = "hour-card";
    article.innerHTML = `
      <p>${new Intl.DateTimeFormat([], { hour: "numeric" }).format(new Date(time))}</p>
      <span class="hour-glyph ${visual}" aria-hidden="true"></span>
      <strong>${round(hourly.temperature_2m?.[index])}°</strong>
    `;
    container.append(article);
  });
}

function renderDaily(daily) {
  const container = $("dailyList");
  container.innerHTML = "";

  (daily.time || []).slice(0, 5).forEach((time, index) => {
    const [summary] = weatherInfo(daily.weather_code?.[index]);
    const article = document.createElement("article");
    article.className = "daily-item";
    article.innerHTML = `
      <div>
        <strong>${new Intl.DateTimeFormat([], { weekday: "long" }).format(new Date(`${time}T12:00:00`))}</strong>
        <p class="muted">${summary}</p>
      </div>
      <strong class="daily-temp">${round(daily.temperature_2m_max?.[index])}° / ${round(daily.temperature_2m_min?.[index])}°</strong>
    `;
    container.append(article);
  });
}

async function updateDriveTimes(location) {
  const container = $("driveList");
  container.innerHTML = "";
  driveRoutes = new Map();

  const rows = await Promise.all(DESTINATIONS.map(async (destination) => {
    const url = `https://router.project-osrm.org/route/v1/driving/${location.lon},${location.lat};${destination.lon},${destination.lat}?overview=full&geometries=geojson&steps=true`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${destination.name}: OSRM ${response.status}`);
    const data = await response.json();
    if (data.code !== "Ok" || !data.routes?.[0]) throw new Error(`${destination.name}: ${data.message || data.code}`);
    const route = data.routes[0];
    const row = {
      name: destination.name,
      destination,
      minutes: Math.round(route.duration / 60),
      miles: miles(route.distance),
      route,
      steps: (route.legs || []).flatMap((leg) => leg.steps || [])
    };
    driveRoutes.set(destination.name, row);
    return row;
  }));

  rows.forEach((row) => {
    container.append(createDataButton(
      row.name,
      `${formatMiles(row.miles)} via OSRM routing, no traffic feed`,
      `${row.minutes} min`,
      "car",
      () => showRoute(row.name)
    ));
  });
}

function showRoute(name) {
  const row = driveRoutes.get(name);
  if (!row || !map || !layers.route) return;

  layers.route.clearLayers();
  const coordinates = row.route.geometry?.coordinates || [];
  const line = coordinates.map(([lon, lat]) => [lat, lon]);
  if (line.length) {
    L.polyline(line, {
      color: activeTheme === "light" ? "#0f6f5c" : "#66e5a2",
      weight: 7,
      opacity: 0.9
    }).addTo(layers.route);
  }

  if (currentLocation) {
    L.marker([currentLocation.lat, currentLocation.lon], { icon: markerIcon("home") })
      .bindPopup("Start")
      .addTo(layers.route);
  }

  L.marker([row.destination.lat, row.destination.lon], { icon: markerIcon("pin") })
    .bindPopup(escapeHtml(row.name))
    .addTo(layers.route);

  $("routeDetails").hidden = false;
  $("routeTitle").textContent = `${row.name}`;
  $("routeSummary").textContent = `${formatDuration(row.route.duration)} · ${formatMiles(miles(row.route.distance))} · OSRM routing, no live traffic`;
  renderRouteSteps(row.steps);

  document.querySelector(".map-panel")?.classList.add("route-mode");
  setText("mapStatus", `Showing route to ${row.name}`);
  setTimeout(() => {
    map.invalidateSize();
    if (line.length) map.fitBounds(line, { padding: [34, 34] });
  }, 150);
}

function clearRoute(options = {}) {
  if (layers.route) layers.route.clearLayers();
  $("routeDetails").hidden = true;
  document.querySelector(".map-panel")?.classList.remove("route-mode");
  if (currentLocation && options.recenter !== false) updateUserMarker(currentLocation);
}

function renderRouteSteps(steps) {
  const container = $("routeSteps");
  container.innerHTML = "";
  if (!steps.length) {
    container.innerHTML = "<li>No turn details returned for this route.</li>";
    return;
  }

  steps.forEach((step, index) => {
    const item = document.createElement("li");
    item.innerHTML = `
      <span class="step-index">${index + 1}</span>
      <span>
        <strong>${escapeHtml(routeInstruction(step))}</strong>
        <span class="meta">${formatDuration(step.duration || 0)} · ${formatMiles(miles(step.distance || 0))}</span>
      </span>
    `;
    container.append(item);
  });
}

function routeInstruction(step) {
  const maneuver = step.maneuver || {};
  const type = String(maneuver.type || "continue").replace(/_/g, " ");
  const modifier = maneuver.modifier ? ` ${maneuver.modifier}` : "";
  const road = step.name ? ` on ${step.name}` : "";

  if (type === "depart") return `Start${road || " route"}`;
  if (type === "arrive") return "Arrive at destination";
  if (type === "turn") return `Turn${modifier}${road}`;
  if (type === "new name") return `Continue${road}`;
  if (type === "roundabout" || type === "rotary") return `Enter ${type}${road}`;
  if (type === "merge") return `Merge${modifier}${road}`;
  if (type === "on ramp") return `Take ramp${modifier}${road}`;
  if (type === "off ramp") return `Take exit${modifier}${road}`;
  return `${type.charAt(0).toUpperCase()}${type.slice(1)}${modifier}${road}`;
}

async function updateMetro() {
  if (!settings.wmataKey) {
    setEmpty("metroList", "Add a WMATA API key in settings to show live Clarendon Station train arrivals.");
    return;
  }

  const url = `https://api.wmata.com/StationPrediction.svc/json/GetPrediction/${CLARENDON_STATION_CODE}?api_key=${encodeURIComponent(settings.wmataKey)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`WMATA ${response.status}`);
  const data = await response.json();
  const trains = (data.Trains || []).slice(0, 8);
  const container = $("metroList");
  container.innerHTML = "";

  if (!trains.length) {
    setEmpty("metroList", "WMATA returned no train predictions for Clarendon right now.");
    return;
  }

  trains.forEach((train) => {
    const line = train.Line || "Rail";
    const destination = train.DestinationName || train.Destination || "Train";
    const minutes = train.Min === "ARR" || train.Min === "BRD" ? train.Min : `${train.Min} min`;
    container.insertAdjacentHTML("beforeend", dataRow(`${line} ${destination}`, `Car ${train.Car || "--"}`, minutes));
  });
}

async function updateMobility(location) {
  const [bikeStations, scooters] = await Promise.allSettled([
    fetchBikes(location),
    fetchScooters(location)
  ]);

  const bikes = bikeStations.status === "fulfilled" ? bikeStations.value : [];
  const scooterList = scooters.status === "fulfilled" ? scooters.value : [];
  const container = $("mobilityList");
  container.innerHTML = "";
  if (layers.bikes) layers.bikes.clearLayers();
  if (layers.scooters) layers.scooters.clearLayers();

  const totalBikes = bikes.reduce((sum, station) => sum + station.free_bikes, 0);
  const totalEbikes = bikes.reduce((sum, station) => sum + (station.ebikes || 0), 0);
  setText(
    "mobilityStatus",
    `${totalBikes} bikes (${totalEbikes} e-bikes) and ${scooterList.length} scooters within ${settings.mobilityRadiusMiles} mi`
  );

  if (!bikes.length && !scooterList.length) {
    setEmpty("mobilityList", "No available bikes or public-feed scooters found inside the configured radius.");
    return;
  }

  bikes.slice(0, 4).forEach((station) => {
    container.append(createDataButton(
      station.name,
      `Capital Bikeshare, ${formatMiles(station.distanceMiles)} away`,
      `${station.free_bikes} bikes`,
      "bike",
      () => showLocationDetail(station, "bike")
    ));
    if (layers.bikes) {
      L.marker([station.lat, station.lon], { icon: markerIcon("bike") })
        .on("click", () => showLocationDetail(station, "bike"))
        .addTo(layers.bikes);
    }
  });

  scooterList.slice(0, 4).forEach((scooter) => {
    const value = scooter.rangeMiles == null ? "Available" : `${formatMiles(scooter.rangeMiles)} range`;
    container.append(createDataButton(
      scooter.name,
      `${formatMiles(scooter.distanceMiles)} away`,
      value,
      "scooter",
      () => showLocationDetail(scooter, "scooter")
    ));
    if (layers.scooters) {
      L.marker([scooter.lat, scooter.lon], { icon: markerIcon("scooter") })
        .on("click", () => showLocationDetail(scooter, "scooter"))
        .addTo(layers.scooters);
    }
  });
}

async function fetchBikes(location) {
  const response = await fetch("https://api.citybik.es/v2/networks/capital-bikeshare", { cache: "no-store" });
  if (!response.ok) throw new Error(`CityBikes ${response.status}`);
  const data = await response.json();
  const radius = settings.mobilityRadiusMiles;
  return (data.network?.stations || [])
    .map((station) => ({
      type: "bike",
      name: station.name,
      lat: station.latitude,
      lon: station.longitude,
      free_bikes: Number(station.free_bikes || 0),
      ebikes: Number(station.extra?.ebikes || 0),
      empty_slots: Number(station.empty_slots || 0),
      distanceMiles: miles(distanceMeters(location, { lat: station.latitude, lon: station.longitude }))
    }))
    .filter((station) => station.free_bikes > 0 && station.distanceMiles <= radius)
    .sort((a, b) => a.distanceMiles - b.distanceMiles);
}

async function fetchScooters(location) {
  const response = await fetch(`${CORS_PROXY_URL}${encodeURIComponent(LIME_ARLINGTON_SCOOTERS_URL)}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Lime Arlington GBFS ${response.status}`);
  const data = await response.json();
  const radius = settings.mobilityRadiusMiles;
  return (data.data?.bikes || [])
    .filter((vehicle) => !Number(vehicle.is_disabled) && !Number(vehicle.is_reserved))
    .filter((vehicle) => String(vehicle.vehicle_type || "").toLowerCase().includes("scooter"))
    .map((vehicle) => ({
      type: "scooter",
      name: "Lime scooter",
      lat: vehicle.lat,
      lon: vehicle.lon,
      battery: vehicle.current_fuel_percent == null ? null : Math.round(Number(vehicle.current_fuel_percent || 0) * 100),
      rangeMiles: vehicle.current_range_meters == null ? null : miles(Number(vehicle.current_range_meters || 0)),
      distanceMiles: miles(distanceMeters(location, { lat: vehicle.lat, lon: vehicle.lon }))
    }))
    .filter((vehicle) => vehicle.distanceMiles <= radius)
    .sort((a, b) => a.distanceMiles - b.distanceMiles);
}

async function updateRestaurants(location) {
  if (!window.opening_hours) {
    setEmpty("restaurantList", "Opening-hours parser unavailable; not listing restaurants without current-open verification.");
    return;
  }

  const query = `
    [out:json][timeout:25];
    (
      node["amenity"~"restaurant|cafe|fast_food|bar|pub"]["opening_hours"](around:${RESTAURANT_RADIUS_METERS},${location.lat},${location.lon});
      way["amenity"~"restaurant|cafe|fast_food|bar|pub"]["opening_hours"](around:${RESTAURANT_RADIUS_METERS},${location.lat},${location.lon});
      relation["amenity"~"restaurant|cafe|fast_food|bar|pub"]["opening_hours"](around:${RESTAURANT_RADIUS_METERS},${location.lat},${location.lon});
    );
    out center tags 80;
  `;
  const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`);
  if (!response.ok) throw new Error(`Overpass ${response.status}`);

  const data = await response.json();
  const open = (data.elements || [])
    .map((element) => normalizeRestaurant(element, location))
    .filter(Boolean)
    .filter((place) => place.openNow)
    .sort((a, b) => a.distanceMiles - b.distanceMiles);

  const container = $("restaurantList");
  container.innerHTML = "";
  if (layers.restaurants) layers.restaurants.clearLayers();
  setText("restaurantStatus", `${open.length} verified open within ${RESTAURANT_RADIUS_MILES} mi`);

  if (!open.length) {
    setEmpty("restaurantList", "No restaurants with verifiable OSM opening_hours are currently open within 0.7 miles.");
    return;
  }

  open.slice(0, 8).forEach((place) => {
    const iconName = placeIcon(place);
    container.append(createDataButton(
      place.name,
      `${place.kind}${place.cuisine ? `, ${place.cuisine}` : ""} · ${formatMiles(place.distanceMiles)}`,
      "Open",
      iconName,
      () => showLocationDetail(place, "restaurant")
    ));
    if (layers.restaurants) {
      L.marker([place.lat, place.lon], { icon: markerIcon(iconName) })
        .on("click", () => showLocationDetail(place, "restaurant"))
        .addTo(layers.restaurants);
    }
  });
}

function normalizeRestaurant(element, location) {
  const tags = element.tags || {};
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  if (!tags.name || !tags.opening_hours || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  try {
    const parser = new window.opening_hours(tags.opening_hours, {
      lat,
      lon,
      address: { country_code: "us" }
    });
    const now = new Date();
    if (typeof parser.getUnknown === "function" && parser.getUnknown(now)) return null;
    return {
      type: "restaurant",
      name: tags.name,
      kind: tags.amenity || "restaurant",
      cuisine: tags.cuisine || "",
      openingHours: tags.opening_hours || "",
      phone: tags.phone || tags["contact:phone"] || "",
      website: tags.website || tags["contact:website"] || "",
      address: formatOsmAddress(tags),
      lat,
      lon,
      openNow: parser.getState(now),
      distanceMiles: miles(distanceMeters(location, { lat, lon }))
    };
  } catch {
    return null;
  }
}

function placeIcon(place) {
  if (place.kind === "cafe") return "coffee";
  if (place.kind === "bar" || place.kind === "pub") return "drink";
  if (place.kind === "fast_food") return "sandwich";
  return "food";
}

function formatOsmAddress(tags) {
  const parts = [
    [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
    tags["addr:city"],
    tags["addr:postcode"]
  ].filter(Boolean);
  return parts.join(", ");
}

function showLocationDetail(item, type) {
  if (!map) return;
  clearRoute({ recenter: false });

  const title = item.name || (type === "scooter" ? "Bird scooter" : "Map item");
  const iconName = type === "restaurant" ? placeIcon(item) : type;
  const markerTitle = escapeHtml(title);
  const markerMeta = type === "restaurant"
    ? "Open now"
    : type === "bike"
      ? `${item.free_bikes} bikes available`
      : item.rangeMiles == null ? "Available scooter" : `${formatMiles(item.rangeMiles)} estimated range`;

  map.setView([item.lat, item.lon], 17);
  L.popup()
    .setLatLng([item.lat, item.lon])
    .setContent(`<strong>${markerTitle}</strong><br>${escapeHtml(markerMeta)}`)
    .openOn(map);
  setText("mapStatus", `Focused on ${title}`);

  $("detailType").textContent = type === "restaurant" ? "Open nearby" : type === "bike" ? "Bike station" : "Scooter";
  $("detailTitle").textContent = title;
  $("detailBody").innerHTML = detailRows(item, type, iconName);
  const dialog = $("detailDialog");
  if (!dialog.open) dialog.showModal();
}

function detailRows(item, type, iconName) {
  const rows = [
    ["Type", type === "restaurant" ? `${item.kind}${item.cuisine ? `, ${item.cuisine}` : ""}` : type === "bike" ? "Capital Bikeshare station" : "Bird scooter"],
    ["Distance", item.distanceMiles != null ? formatMiles(item.distanceMiles) : ""],
    ["Location", `${Number(item.lat).toFixed(5)}, ${Number(item.lon).toFixed(5)}`]
  ];

  if (type === "restaurant") {
    rows.push(["Status", item.openNow ? "Open now" : "Not verified open"]);
    rows.push(["Hours", item.openingHours || "Not listed"]);
    rows.push(["Phone", item.phone || "Not listed"]);
    rows.push(["Address", item.address || "Not listed"]);
    rows.push(["Website", item.website || "Not listed"]);
  } else if (type === "bike") {
    rows.push(["Available bikes", String(item.free_bikes)]);
    rows.push(["E-bikes", String(item.ebikes || 0)]);
    rows.push(["Open docks", String(item.empty_slots || 0)]);
  } else {
    rows.push(["Battery", item.battery == null ? "Not provided by feed" : `${item.battery}%`]);
    rows.push(["Estimated range", item.rangeMiles == null ? "Not provided by feed" : formatMiles(item.rangeMiles)]);
  }

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.lat},${item.lon}`)}`;
  return `
    <div class="detail-hero">
      <span class="row-icon large" aria-hidden="true">${iconSvg(iconName)}</span>
      <a class="primary detail-map-link" href="${mapsUrl}" target="_blank" rel="noopener">Open in Maps</a>
    </div>
    ${rows.filter(([, value]) => value !== "").map(([label, value]) => `
      <div class="detail-row">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `).join("")}
  `;
}

async function permissionState(name) {
  if (!navigator.permissions?.query) return "unknown";
  try {
    const status = await navigator.permissions.query({ name });
    return status.state;
  } catch {
    return "unsupported";
  }
}

async function updatePermissionStatus(extraLines = []) {
  const checks = await Promise.all([
    permissionState("geolocation"),
    permissionState("camera"),
    permissionState("microphone"),
    permissionState("notifications")
  ]);
  const labels = ["Location", "Camera", "Mic", "Notifications"];
  const summary = checks.map((state, index) => `${labels[index]}: ${state}`).join(" · ");
  setText("permissionStatus", [summary, ...extraLines].filter(Boolean).join(" · "));
}

async function requestPagePermissions() {
  const results = [];

  if (navigator.geolocation) {
    await new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          currentLocation = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            accuracy: position.coords.accuracy || 0,
            source: "browser"
          };
          if (!map) initMap();
          updateUserMarker(currentLocation);
          refreshAll();
          results.push("Location requested");
          resolve();
        },
        (error) => {
          results.push(`Location ${error.message}`);
          resolve();
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 120000 }
      );
    });
  }

  if (navigator.mediaDevices?.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getTracks().forEach((track) => track.stop());
      results.push("Camera/mic requested");
    } catch (error) {
      results.push(`Camera/mic ${error.message}`);
    }
  } else {
    results.push("Camera/mic unsupported");
  }

  if ("Notification" in window && Notification.permission === "default") {
    try {
      const state = await Notification.requestPermission();
      results.push(`Notifications ${state}`);
    } catch (error) {
      results.push(`Notifications ${error.message}`);
    }
  }

  if (navigator.storage?.persist) {
    try {
      results.push((await navigator.storage.persist()) ? "Persistent storage allowed" : "Persistent storage not granted");
    } catch (error) {
      results.push(`Storage ${error.message}`);
    }
  }

  if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
    try {
      await document.documentElement.requestFullscreen();
      results.push("Fullscreen allowed");
    } catch (error) {
      results.push(`Fullscreen ${error.message}`);
    }
  }

  if (navigator.wakeLock?.request) {
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      results.push("Screen wake lock active");
    } catch (error) {
      results.push(`Wake lock ${error.message}`);
    }
  }

  updatePermissionStatus(results);
}

async function refreshAll() {
  updateClock();

  if (!currentLocation) {
    setEmpty("driveList", "Waiting for browser location.");
    setEmpty("metroList", settings.wmataKey ? "Waiting for refresh." : "Add a WMATA API key in settings to show live Clarendon Station train arrivals.");
    setEmpty("mobilityList", "Waiting for browser location.");
    setEmpty("restaurantList", "Waiting for browser location.");
    return;
  }

  const tasks = [
    updateWeather(currentLocation).catch((error) => {
      setText("weatherSummary", `Weather unavailable: ${error.message}`);
    }),
    updateDriveTimes(currentLocation).catch((error) => {
      setEmpty("driveList", `Drive estimates unavailable: ${error.message}`);
    }),
    updateMetro().catch((error) => {
      setEmpty("metroList", `Metro unavailable: ${error.message}`);
    }),
    updateMobility(currentLocation).catch((error) => {
      setEmpty("mobilityList", `Mobility feeds unavailable: ${error.message}`);
    }),
    updateRestaurants(currentLocation).catch((error) => {
      setEmpty("restaurantList", `Open restaurant search unavailable: ${error.message}`);
    })
  ];

  await Promise.all(tasks);
}

function fillSettingsForm() {
  $("settingLocation").value = settings.locationLabel;
  $("settingThemeMode").value = settings.themeMode || "auto";
  $("settingRefresh").value = settings.refreshMinutes;
  $("settingMobilityRadius").value = settings.mobilityRadiusMiles;
  $("settingFallbackLat").value = settings.fallbackLat || "";
  $("settingFallbackLon").value = settings.fallbackLon || "";
  $("settingWmataKey").value = settings.wmataKey || "";
}

function wireSettings() {
  $("settingsButton").addEventListener("click", () => {
    fillSettingsForm();
    updatePermissionStatus();
    $("settingsDialog").showModal();
  });

  $("permissionsButton").addEventListener("click", () => {
    fillSettingsForm();
    updatePermissionStatus();
    $("settingsDialog").showModal();
  });

  $("requestPermissions").addEventListener("click", requestPagePermissions);
  $("clearRouteButton").addEventListener("click", clearRoute);
  $("locateButton").addEventListener("click", () => requestLocation({ forceBrowser: true }));

  $("resetSettings").addEventListener("click", () => {
    saveSettings({ ...DEFAULT_SETTINGS });
    applyTheme("dark");
    fillSettingsForm();
    scheduleRefresh();
    initializeLocation();
  });

  $("settingsForm").addEventListener("submit", (event) => {
    if (event.submitter?.value !== "save") return;
    event.preventDefault();
    saveSettings({
      ...settings,
      locationLabel: $("settingLocation").value.trim() || "Current Location",
      themeMode: $("settingThemeMode").value || "auto",
      refreshMinutes: Math.max(1, Number($("settingRefresh").value) || 5),
      mobilityRadiusMiles: Math.max(0.1, Number($("settingMobilityRadius").value) || 1),
      fallbackLat: $("settingFallbackLat").value.trim(),
      fallbackLon: $("settingFallbackLon").value.trim(),
      wmataKey: $("settingWmataKey").value.trim()
    });
    $("settingsDialog").close();
    scheduleRefresh();
    if (settings.themeMode === "light" || settings.themeMode === "dark") applyTheme(settings.themeMode);
    initializeLocation();
  });
}

function scheduleRefresh() {
  clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    if (currentLocation?.source === "browser") {
      requestLocation({ forceBrowser: true });
    } else {
      refreshAll();
    }
  }, settings.refreshMinutes * 60 * 1000);
}

hydrateStaticIcons();
applyTheme(settings.themeMode === "light" ? "light" : "dark");
wireSettings();
updateClock();
setInterval(updateClock, 1000);
scheduleRefresh();
refreshAll();
initializeLocation();
