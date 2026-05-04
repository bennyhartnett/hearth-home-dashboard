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
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png"
  },
  light: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png"
  }
};

const DESTINATIONS = [
  { name: "McLean", lat: 38.9343, lon: -77.1775 },
  { name: "Tysons", lat: 38.9187, lon: -77.2311 },
  { name: "WC Smith @ Navy Yard", lat: 38.8801779, lon: -77.0052196 }
];

const CLARENDON_STATION_CODE = "K02";
const RESTAURANT_RADIUS_MILES = 0.7;
const RESTAURANT_RADIUS_METERS = Math.round(RESTAURANT_RADIUS_MILES * 1609.344);
const STORAGE_KEY = "hearth-dashboard-settings-v2";
const CORS_PROXY_URL = "https://corsproxy.io/?";
const LIME_ARLINGTON_SCOOTERS_URL = "https://data.lime.bike/api/partners/v2/gbfs/arlington/free_bike_status";

const METRO_LINE_NAMES = {
  RD: "Red",
  OR: "Orange",
  YL: "Yellow",
  GR: "Green",
  BL: "Blue",
  SV: "Silver"
};

const DEFAULT_PHOTO_URL = "./photo.png";

const DEFAULT_SETTINGS = {
  locationLabel: "Current Location",
  themeMode: "auto",
  refreshMinutes: 5,
  mobilityRadiusMiles: 2,
  wmataKey: "",
  fallbackLat: "",
  fallbackLon: "",
  photoUrl: ""
};

let settings = loadSettings();
applySettingsFromUrl();
let currentLocation = null;
let refreshTimer = null;
let metroTimer = null;
let map = null;
let tileLayer = null;
let currentTileUrl = null;
let layers = {};
let activeTheme = "dark";
let wakeLock = null;
let driveRoutes = new Map();
let lastDailyData = null;
let userMarker = null;
let lastUserLatLon = null;
let mapCenteredOnce = false;

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
    "wmataKey",
    "photoUrl"
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

/* Apple SF-Symbol-inspired icons (rounded, hairline strokes) */
function iconSvg(name) {
  const icons = {
    bike: '<svg viewBox="0 0 24 24"><circle cx="6" cy="17.5" r="3"/><circle cx="18" cy="17.5" r="3"/><path d="m9.5 17.5 3-7h3l3 7M12.5 10.5l-2.5 7M11 7h3M14.5 7l1 3"/></svg>',
    calendar: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3.5v3M16 3.5v3"/></svg>',
    car: '<svg viewBox="0 0 24 24"><path d="M5 14.5h14a1 1 0 0 0 1-1l-1.4-3.7a3 3 0 0 0-2.8-1.9H8.2a3 3 0 0 0-2.8 1.9L4 13.5a1 1 0 0 0 1 1Z"/><rect x="3.5" y="14.5" width="17" height="4" rx="1.5"/><circle cx="8" cy="17.5" r="1.2"/><circle cx="16" cy="17.5" r="1.2"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5.5l3.5 2"/></svg>',
    coffee: '<svg viewBox="0 0 24 24"><path d="M5 8h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V8ZM16 10h2.5a2.5 2.5 0 0 1 0 5H16M9 4v2M12 3v3"/></svg>',
    food: '<svg viewBox="0 0 24 24"><path d="M7 3v9M5 3v6a2 2 0 0 0 4 0V3M7 12v9M16 3c-1.6 0-3 2-3 4.5S14.4 12 16 12s3-2 3-4.5S17.6 3 16 3ZM16 12v9"/></svg>',
    drink: '<svg viewBox="0 0 24 24"><path d="M6 4h12l-1.4 9a4 4 0 0 1-4 3.5h-1.2a4 4 0 0 1-4-3.5L6 4ZM9.5 20.5h5M12 16.5v4"/></svg>',
    home: '<svg viewBox="0 0 24 24"><path d="m3.5 11 8.5-7 8.5 7M5.5 10v9.5h13V10M10 19.5v-5h4v5"/></svg>',
    map: '<svg viewBox="0 0 24 24"><path d="m9 18-5 2V6l5-2 6 2 5-2v14l-5 2-6-2ZM9 4v14M15 6v14"/></svg>',
    pin: '<svg viewBox="0 0 24 24"><path d="M12 21s7-6.2 7-12.2A7 7 0 0 0 5 8.8C5 14.8 12 21 12 21Z"/><circle cx="12" cy="9" r="2.5"/></svg>',
    sandwich: '<svg viewBox="0 0 24 24"><path d="m4 12 8-6 8 6v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-5ZM4 12h16M8 15h2M13 15h3"/></svg>',
    scooter: '<svg viewBox="0 0 24 24"><path d="M7 17.5h7.5a3.5 3.5 0 0 0 3.5-3.5V4M12 7h6.5M5.5 17.5l4.5-9h3"/><circle cx="5.5" cy="17.5" r="2.5"/><circle cx="18.5" cy="17.5" r="2.5"/></svg>',
    train: '<svg viewBox="0 0 24 24"><rect x="5" y="3.5" width="14" height="14.5" rx="3.5"/><path d="M5 10.5h14M9 21l2.5-3M15 21l-2.5-3"/><circle cx="9" cy="14" r="0.9" fill="currentColor"/><circle cx="15" cy="14" r="0.9" fill="currentColor"/></svg>',
    locate: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.5"/><circle cx="12" cy="12" r="9"/><path d="M12 1.5v3M12 19.5v3M22.5 12h-3M4.5 12h-3"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9.5" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 14.6a1.5 1.5 0 0 0 .3 1.6l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.5 1.5 0 0 0-1.6-.3 1.5 1.5 0 0 0-.9 1.4V20a2 2 0 1 1-4 0v-.1a1.5 1.5 0 0 0-1-1.4 1.5 1.5 0 0 0-1.6.3l-.1.1A2 2 0 1 1 4.9 16l.1-.1a1.5 1.5 0 0 0 .3-1.6 1.5 1.5 0 0 0-1.4-.9H4a2 2 0 1 1 0-4h.1a1.5 1.5 0 0 0 1.4-1 1.5 1.5 0 0 0-.3-1.6L4.9 6.7A2 2 0 1 1 7.7 4l.1.1a1.5 1.5 0 0 0 1.6.3h.1a1.5 1.5 0 0 0 .9-1.4V3a2 2 0 1 1 4 0v.1a1.5 1.5 0 0 0 .9 1.4 1.5 1.5 0 0 0 1.6-.3l.1-.1A2 2 0 1 1 19.7 7l-.1.1a1.5 1.5 0 0 0-.3 1.6v.1a1.5 1.5 0 0 0 1.4.9H21a2 2 0 1 1 0 4h-.1a1.5 1.5 0 0 0-1.4.9Z"/></svg>',
    moon: '<svg viewBox="0 0 24 24"><path d="M20.5 14.5A8 8 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z"/></svg>',
    sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.5 4.5l2.1 2.1M17.4 17.4l2.1 2.1M4.5 19.5l2.1-2.1M17.4 6.6l2.1-2.1"/></svg>',
    auto: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12a9 9 0 0 0 9 9V3a9 9 0 0 0-9 9Z" fill="currentColor"/></svg>'
  };
  return icons[name] || icons.pin;
}

function hydrateStaticIcons() {
  document.querySelectorAll(".section-icon[data-icon]").forEach((element) => {
    element.innerHTML = iconSvg(element.dataset.icon);
  });
}

function applyHeroPhoto() {
  const img = $("heroPhoto");
  if (!img) return;
  const url = (settings.photoUrl || DEFAULT_PHOTO_URL).trim();
  if (img.getAttribute("src") !== url) img.setAttribute("src", url);
}

function formatTimeWithSeconds(date) {
  return new Intl.DateTimeFormat([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  }).format(date);
}

function formatTime(date) {
  return new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" }).format(date);
}

function formatDate(date) {
  return new Intl.DateTimeFormat([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric"
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
  updateThemeButton();
}

function updateThemeButton() {
  const button = $("themeButton");
  if (!button) return;
  const mode = settings.themeMode || "auto";
  const iconName = mode === "light" ? "sun" : mode === "dark" ? "moon" : "auto";
  const icon = button.querySelector(".section-icon");
  if (icon) icon.innerHTML = iconSvg(iconName);
  button.setAttribute("aria-label", `Theme: ${mode}`);
  button.title = `Theme: ${mode}`;
}

function cycleTheme() {
  const order = ["auto", "light", "dark"];
  const current = settings.themeMode || "auto";
  const next = order[(order.indexOf(current) + 1) % order.length];
  saveSettings({ ...settings, themeMode: next });
  if (next === "light" || next === "dark") {
    applyTheme(next);
  } else if (lastDailyData) {
    applyThemeFromSun(lastDailyData);
  }
  updateThemeButton();
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
  let hour = now.getHours() % 12;
  if (hour === 0) hour = 12;
  const min = String(now.getMinutes()).padStart(2, "0");
  const sec = String(now.getSeconds()).padStart(2, "0");

  const clockEl = $("clock");
  if (clockEl) {
    clockEl.textContent = `${hour}:${min}:${sec}`;
  }

  setText("dateLine", formatDate(now));
  updateTrashReminder(now);
}

/* Trash reminder: visible Wednesdays (trash day tomorrow on Thursday). */
function updateTrashReminder(now) {
  const pill = $("trashPill");
  if (!pill) return;
  pill.hidden = now.getDay() !== 3;
}

/* Network status pill ------------------------------------------------ */
function updateNetworkStatus() {
  const pill = $("networkPill");
  const dot = $("networkDot");
  const label = $("networkLabel");
  if (!pill || !dot || !label) return;

  if (!navigator.onLine) {
    dot.className = "pill-dot offline";
    label.textContent = "Offline";
    pill.hidden = false;
  } else {
    pill.hidden = true;
  }
}

function showNotice(message) {
  const notice = $("locationNotice");
  if (!notice) return;
  notice.textContent = message;
  notice.hidden = false;
}

function hideNotice() {
  const notice = $("locationNotice");
  if (notice) notice.hidden = true;
}

function setEmpty(containerId, message) {
  const container = $(containerId);
  if (container) container.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function dataRow(title, meta, value, leadingHtml = "") {
  return `
    <div class="data-row">
      ${leadingHtml}
      <span>
        <strong>${escapeHtml(title)}</strong>
        <span class="meta">${escapeHtml(meta)}</span>
      </span>
      <span class="primary-value">${escapeHtml(value)}</span>
    </div>
  `;
}

function createDataButton(title, meta, value, iconName, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "data-row";
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

function metroLineCircle(code) {
  const safe = ["RD", "OR", "YL", "GR", "BL", "SV"].includes(code) ? code : "NA";
  return `<span class="line-circle line-${safe}" aria-label="${METRO_LINE_NAMES[safe] || "Line"}">${escapeHtml(safe === "NA" ? "—" : safe)}</span>`;
}

/* Map (now used as background) -------------------------------------- */
function initMap() {
  if (!window.L) return;

  map = L.map("map", {
    zoomControl: false,
    attributionControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    touchZoom: false,
    boxZoom: false,
    keyboard: false,
    tap: false
  }).setView([38.889, -77.05], 15);

  layers = {
    user: L.layerGroup().addTo(map),
    restaurants: L.layerGroup().addTo(map),
    bikes: L.layerGroup().addTo(map),
    scooters: L.layerGroup().addTo(map),
    route: L.layerGroup().addTo(map)
  };

  setMapStyle(activeTheme);
  setTimeout(() => map.invalidateSize(), 250);
  window.addEventListener("resize", () => map?.invalidateSize());
}

function setMapStyle(key) {
  if (!map) return;
  const style = MAP_STYLES[key === "light" ? "light" : "dark"];
  if (currentTileUrl === style.url && tileLayer) return;
  if (tileLayer) tileLayer.remove();
  tileLayer = L.tileLayer(style.url, { maxZoom: 19, attribution: "" }).addTo(map);
  currentTileUrl = style.url;
}

function markerIcon(type) {
  const size = type === "user" || type === "home" ? 36 : 32;
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
  const latLon = [location.lat, location.lon];

  if (userMarker) {
    if (lastUserLatLon &&
        lastUserLatLon[0] === latLon[0] &&
        lastUserLatLon[1] === latLon[1]) {
      return;
    }
    userMarker.setLatLng(latLon);
  } else {
    userMarker = L.marker(latLon, { icon: markerIcon("user") }).addTo(layers.user);
  }
  lastUserLatLon = latLon;

  if (!mapCenteredOnce && $("routeDetails")?.hidden !== false) {
    map.setView(latLon, 15);
    mapCenteredOnce = true;
  }
}

function getFallbackLocation() {
  if (String(settings.fallbackLat).trim() === "" || String(settings.fallbackLon).trim() === "") return null;
  const lat = Number(settings.fallbackLat);
  const lon = Number(settings.fallbackLon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon, accuracy: 0, source: "fallback" };
}

function useFallbackLocation(reason = "Using saved location.", silent = false) {
  const fallback = getFallbackLocation();
  if (!fallback) return false;
  currentLocation = fallback;
  if (silent) hideNotice();
  else showNotice(reason);
  if (!map) initMap();
  updateUserMarker(currentLocation);
  refreshAll();
  return true;
}

function requestLocation(options = {}) {
  const forceBrowser = options.forceBrowser === true;
  if (!forceBrowser && useFallbackLocation("Using saved location.", true)) return;

  if (!navigator.geolocation) {
    if (useFallbackLocation("No geolocation. Using saved location.")) return;
    showNotice("Add fallback coordinates in settings to load local data.");
    return;
  }

  showNotice("Requesting location.");
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
      if (useFallbackLocation(`Location unavailable: ${error.message}.`)) return;
      showNotice(`Location unavailable: ${error.message}.`);
      setText("weatherSummary", "Location required");
      setEmpty("driveList", "Location required for drive estimates.");
      setEmpty("mobilityList", "Location required for nearby bikes and scooters.");
      setEmpty("restaurantList", "Location required for open restaurants.");
    },
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 120000 }
  );
}

function initializeLocation() {
  if (useFallbackLocation("Using saved location.", true)) return;
  requestLocation({ forceBrowser: true });
}

/* Weather ----------------------------------------------------------- */
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
      "cloud_cover",
      "is_day"
    ].join(","),
    hourly: "temperature_2m,weather_code,precipitation_probability,precipitation",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset"
  });

  const [forecastResponse, airResponse] = await Promise.allSettled([
    fetch(`https://api.open-meteo.com/v1/forecast?${params}`),
    fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${location.lat}&longitude=${location.lon}&current=us_aqi&timezone=auto`)
  ]);

  if (forecastResponse.status !== "fulfilled" || !forecastResponse.value.ok) {
    throw new Error(`Weather ${forecastResponse.value?.status || "fetch failed"}`);
  }

  const data = await forecastResponse.value.json();
  const current = data.current || {};
  const [summary, visual] = weatherInfo(current.weather_code);
  const daily = data.daily || {};
  const isDay = current.is_day !== 0;
  lastDailyData = daily;

  setText("currentTemp", round(current.temperature_2m));
  setText("weatherSummary", summary);
  setText("feelsLike", `${round(current.apparent_temperature)}°`);
  setText("humidity", `${round(current.relative_humidity_2m)}%`);
  setText("wind", `${round(current.wind_speed_10m)} mph`);
  setText("highLow", `${round(daily.temperature_2m_max?.[0])}° / ${round(daily.temperature_2m_min?.[0])}°`);
  setText("rainSoon", findNextRain(data.hourly || {}));
  setText("cloudCover", `${round(current.cloud_cover)}%`);
  setText("updatedLine", `Updated ${formatTime(new Date())}`);

  /* Sun times: today's sunrise/sunset; if past sunset, next day's sunrise */
  const now = new Date();
  const sunriseToday = daily.sunrise?.[0] ? new Date(daily.sunrise[0]) : null;
  const sunsetToday = daily.sunset?.[0] ? new Date(daily.sunset[0]) : null;
  const sunriseTomorrow = daily.sunrise?.[1] ? new Date(daily.sunrise[1]) : null;

  const nextSunrise = sunriseToday && now < sunriseToday ? sunriseToday : sunriseTomorrow;
  setText("sunriseTime", nextSunrise ? formatTime(nextSunrise) : "--");
  setText("sunsetTime", sunsetToday ? formatTime(sunsetToday) : "--");

  /* Air quality */
  if (airResponse.status === "fulfilled" && airResponse.value.ok) {
    try {
      const air = await airResponse.value.json();
      const aqi = air.current?.us_aqi;
      setText("airQuality", formatAqi(aqi));
    } catch {
      setText("airQuality", "--");
    }
  } else {
    setText("airQuality", "--");
  }

  applyThemeFromSun(daily);
  $("skyScene").className = `sky-scene ${isDay ? "day" : "night"} ${visual}`;
  renderHourly(data.hourly || {});
  renderDaily(daily);
}

function formatAqi(value) {
  if (!Number.isFinite(value)) return "--";
  const v = Math.round(value);
  let label = "Good";
  if (v > 300) label = "Hazardous";
  else if (v > 200) label = "V. Unhealthy";
  else if (v > 150) label = "Unhealthy";
  else if (v > 100) label = "Sensitive";
  else if (v > 50) label = "Moderate";
  return `${v} ${label}`;
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
    container.innerHTML = `<div class="empty-state">No hourly forecast.</div>`;
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
      <strong>${new Intl.DateTimeFormat([], { weekday: "short" }).format(new Date(`${time}T12:00:00`))}</strong>
      <p class="muted">${escapeHtml(summary)}</p>
      <span class="daily-temp">${round(daily.temperature_2m_max?.[index])}° / ${round(daily.temperature_2m_min?.[index])}°</span>
    `;
    container.append(article);
  });
}

/* Driving ----------------------------------------------------------- */
async function updateDriveTimes(location) {
  const container = $("driveList");
  container.innerHTML = "";
  driveRoutes = new Map();

  const rows = await Promise.all(DESTINATIONS.map(async (destination) => {
    const url = `https://router.project-osrm.org/route/v1/driving/${location.lon},${location.lat};${destination.lon},${destination.lat}?overview=full&geometries=geojson&steps=true`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${destination.name}: ${response.status}`);
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
      formatMiles(row.miles),
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
      color: activeTheme === "light" ? "#0fa566" : "#5cf09b",
      weight: 6,
      opacity: 0.95
    }).addTo(layers.route);
  }

  if (currentLocation) {
    L.marker([currentLocation.lat, currentLocation.lon], { icon: markerIcon("home") })
      .addTo(layers.route);
  }

  L.marker([row.destination.lat, row.destination.lon], { icon: markerIcon("pin") })
    .addTo(layers.route);

  $("routeDetails").hidden = false;
  $("routeTitle").textContent = row.name;
  $("routeSummary").textContent = `${formatDuration(row.route.duration)} · ${formatMiles(miles(row.route.distance))}`;
  renderRouteSteps(row.steps);

  setTimeout(() => {
    map.invalidateSize();
    if (line.length) map.fitBounds(line, { padding: [60, 60] });
  }, 150);
}

function clearRoute(options = {}) {
  if (layers.route) layers.route.clearLayers();
  $("routeDetails").hidden = true;
  if (currentLocation && options.recenter !== false) updateUserMarker(currentLocation);
}

function renderRouteSteps(steps) {
  const container = $("routeSteps");
  container.innerHTML = "";
  if (!steps.length) {
    container.innerHTML = "<li>No turn details.</li>";
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

/* Metro (refreshes independently every 30s) -------------------------- */
async function updateMetro() {
  if (!settings.wmataKey) {
    setEmpty("metroList", "Add a WMATA API key in settings to show live train arrivals.");
    return;
  }

  const url = `https://api.wmata.com/StationPrediction.svc/json/GetPrediction/${CLARENDON_STATION_CODE}?api_key=${encodeURIComponent(settings.wmataKey)}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`WMATA ${response.status}`);
  const data = await response.json();
  const trains = (data.Trains || []).slice(0, 6);
  const container = $("metroList");
  container.innerHTML = "";

  if (!trains.length) {
    setEmpty("metroList", "No train predictions right now.");
    return;
  }

  trains.forEach((train) => {
    const code = String(train.Line || "").toUpperCase();
    const lineName = METRO_LINE_NAMES[code] || "";
    const destination = train.DestinationName || train.Destination || "Train";
    const minutes = train.Min === "ARR" ? "Arriving" : train.Min === "BRD" ? "Boarding" : `${train.Min} min`;
    container.insertAdjacentHTML(
      "beforeend",
      dataRow(destination, lineName ? `${lineName} Line` : "Rail", minutes, metroLineCircle(code))
    );
  });

  setText("metroStatus", `Clarendon · updated ${formatTime(new Date())}`);
}

/* Mobility ---------------------------------------------------------- */
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
    `${totalBikes} bikes (${totalEbikes} e-bikes) · ${scooterList.length} scooters within ${settings.mobilityRadiusMiles} mi`
  );

  if (!bikes.length && !scooterList.length) {
    setEmpty("mobilityList", "No nearby bikes or scooters.");
    return;
  }

  bikes.slice(0, 4).forEach((station) => {
    container.append(createDataButton(
      station.name,
      `Capital Bikeshare · ${formatMiles(station.distanceMiles)}`,
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
  if (!response.ok) throw new Error(`Lime ${response.status}`);
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

/* Restaurants -------------------------------------------------------- */
async function updateRestaurants(location) {
  if (!window.opening_hours) {
    setEmpty("restaurantList", "Opening-hours parser unavailable.");
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
  setText("restaurantStatus", `${open.length} open within ${RESTAURANT_RADIUS_MILES} mi`);

  if (!open.length) {
    setEmpty("restaurantList", "No verified-open restaurants nearby.");
    return;
  }

  open.slice(0, 6).forEach((place) => {
    const iconName = placeIcon(place);
    container.append(createDataButton(
      place.name,
      `${place.kind}${place.cuisine ? ` · ${place.cuisine}` : ""} · ${formatMiles(place.distanceMiles)}`,
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

  const title = item.name || (type === "scooter" ? "Scooter" : "Map item");
  const iconName = type === "restaurant" ? placeIcon(item) : type;

  $("detailType").textContent = type === "restaurant" ? "Open nearby" : type === "bike" ? "Bike station" : "Scooter";
  $("detailTitle").textContent = title;
  $("detailBody").innerHTML = detailRows(item, type, iconName);
  const dialog = $("detailDialog");
  if (!dialog.open) dialog.showModal();
}

function detailRows(item, type, iconName) {
  const rows = [
    ["Type", type === "restaurant" ? `${item.kind}${item.cuisine ? `, ${item.cuisine}` : ""}` : type === "bike" ? "Capital Bikeshare" : "Lime scooter"],
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
    rows.push(["Battery", item.battery == null ? "Unknown" : `${item.battery}%`]);
    rows.push(["Range", item.rangeMiles == null ? "Unknown" : formatMiles(item.rangeMiles)]);
  }

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${item.lat},${item.lon}`)}`;
  return `
    <div class="detail-hero">
      <span class="row-icon large" aria-hidden="true">${iconSvg(iconName)}</span>
      <a class="detail-map-link" href="${mapsUrl}" target="_blank" rel="noopener">Open in Maps</a>
    </div>
    ${rows.filter(([, value]) => value !== "").map(([label, value]) => `
      <div class="detail-row">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `).join("")}
  `;
}

/* Permissions -------------------------------------------------------- */
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
        (error) => { results.push(`Location ${error.message}`); resolve(); },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 120000 }
      );
    });
  }

  if (navigator.mediaDevices?.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getTracks().forEach((track) => track.stop());
      results.push("Camera/mic requested");
    } catch (error) { results.push(`Camera/mic ${error.message}`); }
  }

  if ("Notification" in window && Notification.permission === "default") {
    try {
      const state = await Notification.requestPermission();
      results.push(`Notifications ${state}`);
    } catch (error) { results.push(`Notifications ${error.message}`); }
  }

  if (navigator.storage?.persist) {
    try {
      results.push((await navigator.storage.persist()) ? "Persistent storage allowed" : "Persistent storage not granted");
    } catch (error) { results.push(`Storage ${error.message}`); }
  }

  if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
    try {
      await document.documentElement.requestFullscreen();
      results.push("Fullscreen allowed");
    } catch (error) { results.push(`Fullscreen ${error.message}`); }
  }

  if (navigator.wakeLock?.request) {
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      results.push("Wake lock active");
    } catch (error) { results.push(`Wake lock ${error.message}`); }
  }

  updatePermissionStatus(results);
}

/* Refresh ------------------------------------------------------------ */
async function refreshAll() {
  updateClock();

  if (!currentLocation) {
    setEmpty("driveList", "Waiting for location.");
    setEmpty("metroList", settings.wmataKey ? "Waiting for refresh." : "Add a WMATA API key in settings.");
    setEmpty("mobilityList", "Waiting for location.");
    setEmpty("restaurantList", "Waiting for location.");
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
      setEmpty("mobilityList", `Mobility unavailable: ${error.message}`);
    }),
    updateRestaurants(currentLocation).catch((error) => {
      setEmpty("restaurantList", `Restaurants unavailable: ${error.message}`);
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
  $("settingPhotoUrl").value = settings.photoUrl || "";
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
  $("themeButton").addEventListener("click", cycleTheme);

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
      wmataKey: $("settingWmataKey").value.trim(),
      photoUrl: $("settingPhotoUrl").value.trim()
    });
    $("settingsDialog").close();
    scheduleRefresh();
    applyHeroPhoto();
    if (settings.themeMode === "light" || settings.themeMode === "dark") applyTheme(settings.themeMode);
    initializeLocation();
  });
}

function scheduleRefresh() {
  clearInterval(refreshTimer);
  clearInterval(metroTimer);
  refreshTimer = setInterval(() => {
    if (currentLocation?.source === "browser") {
      requestLocation({ forceBrowser: true });
    } else {
      refreshAll();
    }
  }, settings.refreshMinutes * 60 * 1000);

  /* Metro arrivals refresh every 30 seconds independently. */
  metroTimer = setInterval(() => {
    updateMetro().catch((error) => {
      setEmpty("metroList", `Metro unavailable: ${error.message}`);
    });
  }, 30 * 1000);
}

function isMapInteractionTarget(target) {
  return Boolean(target?.closest?.("#map, .leaflet-control, .leaflet-popup"));
}

function wirePageZoomGuards() {
  const blockOutsideMap = (event) => {
    if (event.cancelable && !isMapInteractionTarget(event.target)) event.preventDefault();
  };

  ["gesturestart", "gesturechange", "gestureend"].forEach((type) => {
    document.addEventListener(type, blockOutsideMap, { passive: false });
  });

  document.addEventListener("touchmove", (event) => {
    if (event.cancelable && event.touches?.length > 1 && !isMapInteractionTarget(event.target)) {
      event.preventDefault();
    }
  }, { passive: false });

  document.addEventListener("wheel", (event) => {
    if (event.cancelable && event.ctrlKey && !isMapInteractionTarget(event.target)) {
      event.preventDefault();
    }
  }, { passive: false });

  let lastTouchEnd = 0;
  document.addEventListener("touchend", (event) => {
    const now = Date.now();
    if (event.cancelable && now - lastTouchEnd < 350 && !isMapInteractionTarget(event.target)) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });

  document.addEventListener("keydown", (event) => {
    const zoomKey = ["+", "=", "-", "_", "0"].includes(event.key);
    if ((event.ctrlKey || event.metaKey) && zoomKey && !isMapInteractionTarget(document.activeElement)) {
      event.preventDefault();
    }
  });
}

window.addEventListener("online", updateNetworkStatus);
window.addEventListener("offline", updateNetworkStatus);
if (navigator.connection?.addEventListener) {
  navigator.connection.addEventListener("change", updateNetworkStatus);
}

/* Keep the screen awake. Wake locks are auto-released on visibility loss,
   so re-acquire whenever the page becomes visible again. */
async function acquireWakeLock() {
  if (!navigator.wakeLock?.request) return;
  try {
    if (wakeLock && !wakeLock.released) return;
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener?.("release", () => {
      if (document.visibilityState === "visible") acquireWakeLock();
    });
  } catch {
    /* permission denied or unsupported — ignore */
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") acquireWakeLock();
});
acquireWakeLock();

wirePageZoomGuards();
hydrateStaticIcons();
applyHeroPhoto();
applyTheme(settings.themeMode === "light" ? "light" : "dark");
wireSettings();
updateClock();
updateNetworkStatus();
setInterval(updateClock, 1000);
setInterval(updateNetworkStatus, 30 * 1000);
initMap();
scheduleRefresh();
refreshAll();
initializeLocation();
