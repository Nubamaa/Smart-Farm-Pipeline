# Smart-Farm-Pipeline

This repository is the GitHub-ready base for the Smart-Farm-Pipeline project. It includes:

- A GitHub Pages-ready React landing page
- The Arduino UNO R4 WiFi firmware for secure MQTT, photoresistor day/night detection, and the publish/sleep cycle
- A Supabase schema file for sensor logs
- A simple structure that matches the five assignment phases

## Repo Layout

- `src/` - React front end for GitHub Pages
- `hardware/` - Arduino sketch for the UNO R4 WiFi
- `sql/` - Supabase table setup and analytics helpers
- `docs/` - assignment notes and deployment guidance

## Local Setup

1. Install Node.js 18+.
2. Run `npm install`.
3. Start the site with `npm run dev`.

### Supabase configuration (for the dashboard)

1. Create a Supabase project and the `sensor_logs` table (see `sql/sensor_logs.sql`).
2. In your Supabase Project Settings → API copy the `Project URL` and the `anon` public key.
3. Create a `.env` file at the project root with these values:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

4. Restart the dev server. The dashboard will poll the `sensor_logs` table and show live readings.

For GitHub Pages, add these repository secrets in GitHub Settings → Secrets and variables → Actions:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

The Pages workflow reads those secrets during the build, so the deployed static site can fetch Supabase data in the browser.

Note: For GitHub Pages the site is static and cannot directly use the anon key safely in a public repository — instead use a small serverless proxy or restrict keys in Supabase Row Level Security as appropriate for your course.

## Useful docs

- n8n MQTT → Supabase code and mapping: `docs/n8n_mqtt_to_supabase.md`
- Wiring and pin map: `docs/wiring.md`
- RLS & security guidance: `docs/rls_and_security.md`

## Quick dev commands

Start dev server:
```bash
npm install
npm run dev
```

Build production:
```bash
npm run build
```

## Build and Deploy to GitHub Pages

The project uses `gh-pages` for static hosting.

1. Build locally with `npm run build`.
2. Deploy with `npm run deploy`.
3. In GitHub Pages settings, point the site to the `gh-pages` branch.

The Vite config uses a relative base path, so the site can be served from GitHub Pages without extra routing changes.

If you are publishing from GitHub Actions instead of the `gh-pages` branch, keep the workflow in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) enabled and set GitHub Pages to use the Actions source.

## Assignment Notes

### Phase 1

Use `WiFiSSLClient` and port `8883` for secure MQTT.

### Hardware

- DHT11 on `D2` for temperature and humidity
- Photoresistor on `A0` for day/night detection
- Yellow LED on `D4` for daytime
- Blue LED on `D5` for nighttime
- Red LED on `D6` for hot-temperature warning

### Phase 2

Disconnect after publish, turn off Wi-Fi, then reconnect after the sleep interval.

### Phase 3

Use Supabase as the long-term storage layer.

### Phase 4

Use n8n to bridge Adafruit IO MQTT messages into Supabase.

### Phase 5

Host the front end on GitHub Pages and fetch analytics from Supabase.

## Analytics Focus

The assignment is not only about charts. The repo is structured around analytics questions such as:

- Which node has the highest uptime?
- Which node is showing heat stress?
- What are the daily averages per node?
- Is the temperature rising or falling over time?
