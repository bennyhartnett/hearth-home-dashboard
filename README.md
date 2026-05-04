# Hearth Home Dashboard

A static GitHub Pages dashboard for a wall-mounted Hearth Display running Fully Kiosk Browser.

The page is intentionally safe for a public repo:

- No API keys are required for the weather card.
- No Hearth ADB details are stored here.
- The optional WMATA key is entered in the browser UI and stays in that device's local storage.
- No device location, local network URLs, pairing codes, or private tokens are committed.

## What It Shows

- Current weather from Open-Meteo.
- Animated weather/time-of-day scene and automatic photo scene selection based on dominant weather plus sunrise/sunset-aware time buckets.
- Current-location map that follows the page theme with dark/light CARTO tiles.
- Route estimates to McLean, Tysons, and Navy Yard via OSRM, with clickable turn-by-turn route details.
- Clarendon Station train arrivals via WMATA when a local API key is configured.
- Nearby Capital Bikeshare stations via CityBikes.
- Nearby Lime scooters via Arlington's public GBFS feed.
- Restaurants within 0.7 miles that are currently open according to OpenStreetMap `opening_hours` data from Overpass, with details for hours, phone, address, and website when OSM has them.
- Auto light/dark mode based on sunrise and sunset, plus manual light/dark settings.
- Page permission prompts for location, camera, microphone, notifications, persistent storage, fullscreen, and screen wake lock.
- A kiosk-friendly portrait layout for a 1080x1920 display.

## Data Notes

This dashboard does not use fallback sample values. If a live source is unavailable, rate-limited, lacks CORS support, or requires configuration, the card shows that state instead of made-up data.

GitHub Pages is served over HTTPS. Browser geolocation must be allowed for true current-location loading. Fully Kiosk Browser requires its PLUS geolocation setting for HTML geolocation; without that, enter fallback coordinates in the Hearth settings dialog so the device can still use live data feeds without committing a location to GitHub. WMATA requires a developer key for rail predictions; enter it on the Hearth settings dialog, not in this repository. The Arlington scooter feed is loaded through a public CORS proxy because the vendor feed does not allow direct browser reads from a static page.

## Configure On The Hearth

Open the dashboard, tap the gear button, and set:

- Location label
- Theme mode
- Refresh interval
- Mobility radius
- Optional fallback latitude and longitude
- Optional WMATA API key
- Optional photo URL override; leave it empty to use automatic weather/time scenes

Those settings are stored in the Hearth browser's local storage, not in this public repository.

Use the Permissions button to request browser-level kiosk permissions for this page. Android or Fully Kiosk may still require app-level permission settings outside this static page.

For kiosk setup over ADB, the same device-only settings can be saved by opening a one-time URL with query parameters:

```text
https://bennyhartnett.github.io/hearth-home-dashboard/?saveLocalSettings=1&locationLabel=Home&fallbackLat=LATITUDE&fallbackLon=LONGITUDE
```

The page saves the allowed settings locally, then strips those parameters from the address bar. Use real coordinates only on the private Hearth device, not in commits.
