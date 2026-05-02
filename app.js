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
  streets: {
    label: "Streets",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors"
  },
  light: {
    label: "Light",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap &copy; CARTO"
  },
  topo: {
    label: "Topo",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors, SRTM | OpenTopoMap"
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

const DEFAULT_SETTINGS = {
  locationLabel: "Current Location",
  refreshMinutes: 5,
  mobilityRadiusMiles: 2,
  mapStyle: "streets",
  wmataKey: "",
  fallbackLat: "",
  fallbackLon: ""
};

let settings = loadSettings();
let currentLocation = null;
let refreshTimer = null;
let map = null;
let tileLayer = null;
let layers = {};

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

function setText(id, text) {
  const element = $(id);
  if (element) element.textContent = text;
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
        <strong>${title}</strong>
        <p class="meta">${meta}</p>
      </div>
      <div class="primary-value">${value}</div>
    </div>
  `;
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
    scooters: L.layerGroup().addTo(map)
  };

  renderStyleButtons();
  setMapStyle(settings.mapStyle);
  setTimeout(() => map.invalidateSize(), 250);
}

function renderStyleButtons() {
  const container = $("styleButtons");
  container.innerHTML = "";
  Object.entries(MAP_STYLES).forEach(([key, style]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = style.label;
    button.className = key === settings.mapStyle ? "active" : "";
    button.addEventListener("click", () => {
      saveSettings({ ...settings, mapStyle: key });
      setMapStyle(key);
      renderStyleButtons();
    });
    container.append(button);
  });
}

function setMapStyle(key) {
  if (!map) return;
  const style = MAP_STYLES[key] || MAP_STYLES.dark;
  if (tileLayer) tileLayer.remove();
  tileLayer = L.tileLayer(style.url, {
    maxZoom: 19,
    attribution: style.attribution
  }).addTo(map);
  setTimeout(() => map.invalidateSize(), 100);
}

function markerIcon(type) {
  return L.divIcon({
    html: `<div class="marker-dot ${type}"></div>`,
    className: "",
    iconSize: type === "user" ? [30, 30] : [24, 24],
    iconAnchor: type === "user" ? [15, 15] : [12, 12]
  });
}

function updateUserMarker(location) {
  if (!map) return;
  layers.user.clearLayers();
  L.marker([location.lat, location.lon], { icon: markerIcon("user") })
    .bindPopup(location.source === "fallback" ? "Saved fallback location" : "Current location")
    .addTo(layers.user);
  map.invalidateSize();
  map.setView([location.lat, location.lon], 15);
  setText(
    "mapStatus",
    location.source === "fallback"
      ? "Using local-only saved location"
      : `Location accuracy ${Math.round(location.accuracy)} m`
  );
}

function getFallbackLocation() {
  const lat = Number(settings.fallbackLat);
  const lon = Number(settings.fallbackLon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon, accuracy: 0, source: "fallback" };
}

function useFallbackLocation(reason) {
  const fallback = getFallbackLocation();
  if (!fallback) return false;
  currentLocation = fallback;
  showNotice(`${reason} Using the saved local-only fallback location from this browser.`);
  if (!map) initMap();
  updateUserMarker(currentLocation);
  refreshAll();
  return true;
}

function requestLocation() {
  if (!navigator.geolocation) {
    showNotice("This browser does not expose geolocation. Live local sections cannot load without a current location.");
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
      if (useFallbackLocation(`Browser location unavailable: ${error.message}.`)) return;
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
    hourly: "temperature_2m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min"
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
  setText("updatedLine", `Updated ${formatTime(new Date())}`);

  $("skyScene").className = `sky-scene ${isDay ? "day" : "night"} ${visual}`;
  renderHourly(data.hourly || {});
  renderDaily(daily);
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

  const rows = await Promise.all(DESTINATIONS.map(async (destination) => {
    const url = `https://router.project-osrm.org/route/v1/driving/${location.lon},${location.lat};${destination.lon},${destination.lat}?overview=false`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${destination.name}: OSRM ${response.status}`);
    const data = await response.json();
    if (data.code !== "Ok" || !data.routes?.[0]) throw new Error(`${destination.name}: ${data.message || data.code}`);
    const route = data.routes[0];
    return {
      name: destination.name,
      minutes: Math.round(route.duration / 60),
      miles: miles(route.distance)
    };
  }));

  rows.forEach((row) => {
    container.insertAdjacentHTML(
      "beforeend",
      dataRow(row.name, `${formatMiles(row.miles)} via OSRM routing, no traffic feed`, `${row.minutes} min`)
    );
  });
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
    container.insertAdjacentHTML(
      "beforeend",
      dataRow(
        station.name,
        `Capital Bikeshare, ${formatMiles(station.distanceMiles)} away`,
        `${station.free_bikes} bikes`
      )
    );
    if (layers.bikes) {
      L.marker([station.lat, station.lon], { icon: markerIcon("bike") })
        .bindPopup(`${station.name}<br>${station.free_bikes} bikes`)
        .addTo(layers.bikes);
    }
  });

  scooterList.slice(0, 4).forEach((scooter) => {
    container.insertAdjacentHTML(
      "beforeend",
      dataRow("Bird scooter", `${formatMiles(scooter.distanceMiles)} away`, `${scooter.battery}%`)
    );
    if (layers.scooters) {
      L.marker([scooter.lat, scooter.lon], { icon: markerIcon("scooter") })
        .bindPopup(`Bird scooter<br>${scooter.battery}% battery`)
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
      name: station.name,
      lat: station.latitude,
      lon: station.longitude,
      free_bikes: Number(station.free_bikes || 0),
      ebikes: Number(station.extra?.ebikes || 0),
      distanceMiles: miles(distanceMeters(location, { lat: station.latitude, lon: station.longitude }))
    }))
    .filter((station) => station.free_bikes > 0 && station.distanceMiles <= radius)
    .sort((a, b) => a.distanceMiles - b.distanceMiles);
}

async function fetchScooters(location) {
  const response = await fetch("https://mds.bird.co/gbfs/v2/public/washington-dc/free_bike_status.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Bird GBFS ${response.status}`);
  const data = await response.json();
  const radius = settings.mobilityRadiusMiles;
  return (data.data?.bikes || [])
    .filter((vehicle) => !vehicle.is_disabled && !vehicle.is_reserved)
    .map((vehicle) => ({
      lat: vehicle.lat,
      lon: vehicle.lon,
      battery: Math.round(Number(vehicle.current_fuel_percent || 0) * 100),
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
    container.insertAdjacentHTML(
      "beforeend",
      dataRow(place.name, `${place.kind}${place.cuisine ? `, ${place.cuisine}` : ""} · ${formatMiles(place.distanceMiles)}`, "Open")
    );
    if (layers.restaurants) {
      L.marker([place.lat, place.lon], { icon: markerIcon("restaurant") })
        .bindPopup(`${place.name}<br>Open now`)
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
      name: tags.name,
      kind: tags.amenity || "restaurant",
      cuisine: tags.cuisine || "",
      lat,
      lon,
      openNow: parser.getState(now),
      distanceMiles: miles(distanceMeters(location, { lat, lon }))
    };
  } catch {
    return null;
  }
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
  $("settingRefresh").value = settings.refreshMinutes;
  $("settingMobilityRadius").value = settings.mobilityRadiusMiles;
  $("settingFallbackLat").value = settings.fallbackLat || "";
  $("settingFallbackLon").value = settings.fallbackLon || "";
  $("settingWmataKey").value = settings.wmataKey || "";
}

function wireSettings() {
  $("settingsButton").addEventListener("click", () => {
    fillSettingsForm();
    $("settingsDialog").showModal();
  });

  $("locateButton").addEventListener("click", requestLocation);

  $("resetSettings").addEventListener("click", () => {
    saveSettings({ ...DEFAULT_SETTINGS });
    fillSettingsForm();
    scheduleRefresh();
    refreshAll();
  });

  $("settingsForm").addEventListener("submit", (event) => {
    if (event.submitter?.value !== "save") return;
    event.preventDefault();
    saveSettings({
      ...settings,
      locationLabel: $("settingLocation").value.trim() || "Current Location",
      refreshMinutes: Math.max(1, Number($("settingRefresh").value) || 5),
      mobilityRadiusMiles: Math.max(0.1, Number($("settingMobilityRadius").value) || 1),
      fallbackLat: $("settingFallbackLat").value.trim(),
      fallbackLon: $("settingFallbackLon").value.trim(),
      wmataKey: $("settingWmataKey").value.trim()
    });
    $("settingsDialog").close();
    scheduleRefresh();
    refreshAll();
  });
}

function scheduleRefresh() {
  clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    if (currentLocation) {
      requestLocation();
    } else {
      refreshAll();
    }
  }, settings.refreshMinutes * 60 * 1000);
}

wireSettings();
updateClock();
setInterval(updateClock, 1000);
scheduleRefresh();
refreshAll();
requestLocation();
