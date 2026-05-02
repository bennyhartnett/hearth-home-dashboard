const WEATHER_CODES = {
  0: ["Clear", "☀"],
  1: ["Mostly clear", "🌤"],
  2: ["Partly cloudy", "⛅"],
  3: ["Cloudy", "☁"],
  45: ["Fog", "🌫"],
  48: ["Rime fog", "🌫"],
  51: ["Light drizzle", "🌦"],
  53: ["Drizzle", "🌦"],
  55: ["Heavy drizzle", "🌧"],
  61: ["Light rain", "🌧"],
  63: ["Rain", "🌧"],
  65: ["Heavy rain", "🌧"],
  71: ["Light snow", "🌨"],
  73: ["Snow", "🌨"],
  75: ["Heavy snow", "🌨"],
  80: ["Rain showers", "🌦"],
  81: ["Showers", "🌧"],
  82: ["Heavy showers", "🌧"],
  95: ["Thunderstorm", "⛈"],
  96: ["Thunderstorm", "⛈"],
  99: ["Thunderstorm", "⛈"]
};

const DEFAULT_LOCAL_CARDS = [
  {
    title: "Indoor Temp",
    value: "72.1°",
    detail: "Demo value",
    unit: "",
    endpoint: "",
    path: "temperature"
  },
  {
    title: "Humidity",
    value: "42%",
    detail: "Demo value",
    unit: "",
    endpoint: "",
    path: "humidity"
  },
  {
    title: "Air Quality",
    value: "Good",
    detail: "Demo value",
    unit: "",
    endpoint: "",
    path: "status"
  },
  {
    title: "Network",
    value: "Online",
    detail: "Demo value",
    unit: "",
    endpoint: "",
    path: "status"
  }
];

const DEFAULT_SETTINGS = {
  locationLabel: "Home",
  latitude: 40.7128,
  longitude: -74.006,
  refreshMinutes: 5,
  localCards: DEFAULT_LOCAL_CARDS
};

const STORAGE_KEY = "hearth-dashboard-settings-v1";

let settings = loadSettings();
let refreshTimer;

const $ = (id) => document.getElementById(id);

function loadSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      localCards: Array.isArray(stored?.localCards) ? stored.localCards : DEFAULT_LOCAL_CARDS
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

function saveSettings(nextSettings) {
  settings = nextSettings;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function formatTime(date) {
  return new Intl.DateTimeFormat([], {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
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

function weatherInfo(code) {
  return WEATHER_CODES[code] || ["Weather", "•"];
}

function deepGet(value, path) {
  if (!path) return value;
  return path.split(".").reduce((current, key) => current?.[key], value);
}

function updateClock() {
  const now = new Date();
  $("clock").textContent = formatTime(now);
  $("dateLine").textContent = formatDate(now);
}

async function updateWeather() {
  $("locationLabel").textContent = settings.locationLabel || "Home";

  const params = new URLSearchParams({
    latitude: String(settings.latitude),
    longitude: String(settings.longitude),
    timezone: "auto",
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "weather_code",
      "wind_speed_10m"
    ].join(","),
    hourly: "temperature_2m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min"
  });

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
  if (!response.ok) throw new Error(`Weather request failed: ${response.status}`);

  const data = await response.json();
  const current = data.current || {};
  const [summary, icon] = weatherInfo(current.weather_code);
  const daily = data.daily || {};

  $("currentTemp").textContent = round(current.temperature_2m);
  $("weatherSummary").textContent = summary;
  $("weatherIcon").textContent = icon;
  $("feelsLike").textContent = `${round(current.apparent_temperature)}°`;
  $("humidity").textContent = `${round(current.relative_humidity_2m)}%`;
  $("wind").textContent = `${round(current.wind_speed_10m)} mph`;
  $("highLow").textContent = `${round(daily.temperature_2m_max?.[0])}° / ${round(daily.temperature_2m_min?.[0])}°`;
  $("updatedLine").textContent = `Updated ${formatTime(new Date())}`;

  renderHourly(data.hourly || {});
  renderDaily(daily);
}

function renderHourly(hourly) {
  const container = $("hourlyStrip");
  container.innerHTML = "";

  const now = Date.now();
  const times = hourly.time || [];
  const startIndex = Math.max(0, times.findIndex((time) => new Date(time).getTime() > now));

  times.slice(startIndex, startIndex + 6).forEach((time, offset) => {
    const index = startIndex + offset;
    const [, icon] = weatherInfo(hourly.weather_code?.[index]);
    const article = document.createElement("article");
    article.className = "hour-card";
    article.innerHTML = `
      <p>${new Intl.DateTimeFormat([], { hour: "numeric" }).format(new Date(time))}</p>
      <span>${icon}</span>
      <strong>${round(hourly.temperature_2m?.[index])}°</strong>
    `;
    container.append(article);
  });
}

function renderDaily(daily) {
  const container = $("dailyList");
  container.innerHTML = "";

  (daily.time || []).slice(0, 5).forEach((time, index) => {
    const [summary, icon] = weatherInfo(daily.weather_code?.[index]);
    const article = document.createElement("article");
    article.className = "daily-item";
    article.innerHTML = `
      <div>
        <strong>${new Intl.DateTimeFormat([], { weekday: "long" }).format(new Date(`${time}T12:00:00`))}</strong>
        <p class="muted">${summary}</p>
      </div>
      <span class="daily-icon">${icon}</span>
      <strong class="daily-temp">${round(daily.temperature_2m_max?.[index])}° / ${round(daily.temperature_2m_min?.[index])}°</strong>
    `;
    container.append(article);
  });
}

async function fetchLocalCard(card) {
  if (!card.endpoint) return card;

  const headers = {};
  if (card.authorization) {
    headers.Authorization = card.authorization;
  }

  const response = await fetch(card.endpoint, { headers, cache: "no-store" });
  if (!response.ok) throw new Error(`${response.status}`);

  const data = await response.json();
  const value = deepGet(data, card.path);
  const detail = card.detailPath ? deepGet(data, card.detailPath) : card.detail;

  return {
    ...card,
    value: value ?? card.value ?? "--",
    detail: detail ?? "Live"
  };
}

async function renderLocalCards() {
  const container = $("localGrid");
  container.innerHTML = "";

  const cards = await Promise.all(settings.localCards.map(async (card) => {
    try {
      return await fetchLocalCard(card);
    } catch (error) {
      return {
        ...card,
        value: card.value || "--",
        detail: `Unavailable: ${error.message}`
      };
    }
  }));

  const hasLiveCards = settings.localCards.some((card) => card.endpoint);
  $("localStatus").textContent = hasLiveCards
    ? `Updated ${formatTime(new Date())}`
    : "Demo values until local endpoints are configured";

  cards.forEach((card) => {
    const article = document.createElement("article");
    article.className = "local-card";
    article.innerHTML = `
      <h3>${card.title || "Local"}</h3>
      <span class="local-value">${card.value ?? "--"}${card.unit || ""}</span>
      <p class="local-sub">${card.detail || ""}</p>
    `;
    container.append(article);
  });
}

async function refreshAll() {
  updateClock();
  try {
    await updateWeather();
  } catch (error) {
    $("weatherSummary").textContent = `Weather unavailable: ${error.message}`;
  }
  await renderLocalCards();
}

function fillSettingsForm() {
  $("settingLocation").value = settings.locationLabel;
  $("settingLat").value = settings.latitude;
  $("settingLon").value = settings.longitude;
  $("settingRefresh").value = settings.refreshMinutes;
  $("settingLocalCards").value = JSON.stringify(settings.localCards, null, 2);
}

function wireSettings() {
  $("settingsButton").addEventListener("click", () => {
    fillSettingsForm();
    $("settingsDialog").showModal();
  });

  $("resetSettings").addEventListener("click", () => {
    saveSettings({ ...DEFAULT_SETTINGS });
    fillSettingsForm();
    refreshAll();
  });

  $("settingsForm").addEventListener("submit", (event) => {
    if (event.submitter?.value !== "save") return;
    event.preventDefault();

    let localCards;
    try {
      localCards = JSON.parse($("settingLocalCards").value);
      if (!Array.isArray(localCards)) throw new Error("Local cards must be an array.");
    } catch (error) {
      alert(`Invalid local cards JSON: ${error.message}`);
      return;
    }

    saveSettings({
      locationLabel: $("settingLocation").value.trim() || "Home",
      latitude: Number($("settingLat").value),
      longitude: Number($("settingLon").value),
      refreshMinutes: Math.max(1, Number($("settingRefresh").value) || 5),
      localCards
    });

    $("settingsDialog").close();
    scheduleRefresh();
    refreshAll();
  });
}

function scheduleRefresh() {
  clearInterval(refreshTimer);
  refreshTimer = setInterval(refreshAll, settings.refreshMinutes * 60 * 1000);
}

wireSettings();
updateClock();
setInterval(updateClock, 1000);
scheduleRefresh();
refreshAll();
