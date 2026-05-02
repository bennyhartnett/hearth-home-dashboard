# Hearth Home Dashboard

A static GitHub Pages dashboard for a wall-mounted Hearth Display running Fully Kiosk Browser.

The page is intentionally safe for a public repo:

- No API keys are required for the weather card.
- No Hearth ADB details are stored here.
- The optional WMATA key is entered in the browser UI and stays in that device's local storage.
- No device location, local network URLs, pairing codes, or private tokens are committed.

## What It Shows

- Current weather from Open-Meteo.
- Animated weather/time-of-day scene and animated gradient background.
- Current-location map with selectable OpenStreetMap/CARTO/OpenTopoMap styles.
- Route estimates to McLean, Tysons, and Navy Yard via OSRM.
- Clarendon Station train arrivals via WMATA when a local API key is configured.
- Nearby Capital Bikeshare stations via CityBikes.
- Nearby Bird scooters via public GBFS.
- Restaurants within 0.7 miles that are currently open according to OpenStreetMap `opening_hours` data from Overpass.
- A kiosk-friendly portrait layout for a 1080x1920 display.

## Data Notes

This dashboard does not use fallback sample values. If a live source is unavailable, rate-limited, lacks CORS support, or requires configuration, the card shows that state instead of made-up data.

GitHub Pages is served over HTTPS. Browser geolocation must be allowed for true current-location loading. Fully Kiosk Browser requires its PLUS geolocation setting for HTML geolocation; without that, enter fallback coordinates in the Hearth settings dialog so the device can still use live data feeds without committing a location to GitHub. WMATA requires a developer key for rail predictions; enter it on the Hearth settings dialog, not in this repository.

## Configure On The Hearth

Open the dashboard, tap the gear button, and set:

- Location label
- Refresh interval
- Mobility radius
- Optional fallback latitude and longitude
- Optional WMATA API key

Those settings are stored in the Hearth browser's local storage, not in this public repository.
