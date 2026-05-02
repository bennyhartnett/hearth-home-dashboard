# Hearth Home Dashboard

A static GitHub Pages dashboard for a wall-mounted Hearth Display running Fully Kiosk Browser.

The page is intentionally safe for a public repo:

- No API keys are required for the weather card.
- No Hearth ADB details are stored here.
- Local home endpoints and tokens should be configured in the browser UI, where they stay in that device's local storage.

## What It Shows

- Current weather from Open-Meteo.
- Hourly and daily forecast summaries.
- Local/home data cards from configurable JSON endpoints.
- A kiosk-friendly portrait layout for a 1080x1920 display.

## Local Data Notes

GitHub Pages is served over HTTPS. Browsers often block requests from an HTTPS page to plain local HTTP endpoints as mixed content. If your local data source is HTTP-only, use one of these approaches:

- Host this same static site on your local network over HTTP.
- Put your local dashboard/data service behind HTTPS.
- Enable the appropriate mixed-content setting in your kiosk browser only if you understand the tradeoff.
- Use a local service that supports CORS and HTTPS.

Do not commit private URLs, long-lived tokens, or home network details to this repo.

## Configure On The Hearth

Open the dashboard, tap the gear button, and set:

- Location label
- Latitude and longitude
- Local card JSON endpoints
- Refresh interval

Those settings are stored in the Hearth browser's local storage, not in this public repository.
