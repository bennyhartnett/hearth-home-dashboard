# Custom Home Dashboard

A static GitHub Pages dashboard for a wall-mounted Android display running Fully Kiosk Browser.

The page is intentionally safe for a public repo:

- No API keys are required for the weather card.
- No device ADB details are stored here.
- No device location, local network URLs, pairing codes, or private tokens are committed.

## What It Shows

- Current weather from Open-Meteo.
- Animated weather/time-of-day scene and automatic photo scene selection based on dominant weather plus sunrise/sunset-aware time buckets.
- Clickable scene photo carousel that reverts to the automatic weather/time image after five minutes.
- Overnight specialty photo cycle from midnight through 5 AM.
- A bundled black-and-white map of 923 N Daniel and its real surrounding street layout, with no external tile or map-API dependency.
- Toll-free route estimates via OSRM, with clickable turn-by-turn route details.
- Nearby Capital Bikeshare stations via CityBikes.
- Nearby Lime scooters via Arlington's public GBFS feed.
- Metro and Open Nearby are hidden while those integrations are out of service.
- Auto light/dark mode that switches at sunrise and sunset, plus manual light/dark settings.
- Page permission prompts for location, camera, microphone, notifications, persistent storage, fullscreen, and screen wake lock.
- A kiosk-friendly portrait layout for a 1080x1920 display.

## Data Notes

This dashboard does not use fallback sample values. If a live source is temporarily offline, rate-limited, lacks CORS support, or requires configuration, the card keeps its last good data when it has one and otherwise shows a calm updating state.

GitHub Pages is served over HTTPS. Browser geolocation must be allowed for true current-location loading. Fully Kiosk Browser requires its PLUS geolocation setting for HTML geolocation; without that, enter fallback coordinates in the custom display settings dialog so the device can still use live data feeds without committing a location to GitHub. The neighborhood map is a bundled image based on OpenStreetMap geometry, so it never requests external map tiles or displays a map-provider API error. The Arlington scooter feed is loaded through a public CORS proxy because the vendor feed does not allow direct browser reads from a static page.

## Configure On The Custom Display

Open the dashboard, tap the gear button, and set:

- Location label
- Theme mode
- Refresh interval
- Mobility radius
- Optional fallback latitude and longitude
- Optional photo URL override; leave it empty to use automatic weather/time scenes

Those settings are stored in the display browser's local storage, not in this public repository.

Use the Permissions button to request browser-level kiosk permissions for this page. Android or Fully Kiosk may still require app-level permission settings outside this static page.

For kiosk setup over ADB, the same device-only settings can be saved by opening a one-time URL with query parameters:

```text
https://YOUR_USER.github.io/YOUR_REPO/?saveLocalSettings=1&locationLabel=Home&fallbackLat=LATITUDE&fallbackLon=LONGITUDE
```

The page saves the allowed settings locally, then strips those parameters from the address bar. Use real coordinates only on the private display device, not in commits.

## Rate-Limit Budget

The dashboard enforces a minimum 5-minute general refresh and keeps provider-specific requests inside published public limits:

- Open-Meteo weather and air quality: 2 calls every 5 minutes, about 576/day, below the free non-commercial limit of 10,000/day, 5,000/hour, and 600/minute.
- OSRM demo routing: 8 route calls every 5 minutes, paced one at a time with a 1.1-second delay, under the 1 request/second demo-server policy.
- CityBikes: 1 Capital Bikeshare request every 5 minutes, about 12/hour, below the 300/hour public API limit.
- Lime GBFS through the CORS proxy: 1 request every 5 minutes, matching the GBFS expectation that near-realtime vehicle feeds be no more than 5 minutes stale.
- The bundled map image makes no recurring network requests.
- GitHub Pages update check: 1 lightweight HTML check per minute, far below the 100 GB/month soft bandwidth limit for a single private kiosk display.

## Deploy Notes

After the page has loaded this release once, it checks the deployed dashboard every minute and automatically reloads when the `custom-display-build` marker in `index.html` changes. Bump the `custom-display-build` value plus the `styles.css?v=...` and `app.js?v=...` query strings together for each dashboard deploy so the display picks up the new build without a manual refresh.

Run the smoke checks before deploying:

```text
node scripts/smoke.js
```
