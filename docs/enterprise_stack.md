# Smart Farm Enterprise Stack

This document explains the full upgrade path for the Smart Farm prototype and gives a clean copy of the final stack based on this repository.

## Goal

Upgrade the prototype into a professional, serverless IoT pipeline with:

- Edge security for device traffic
- Battery-conscious publish/sleep behavior
- Long-term cloud storage for analytics
- n8n as the event-driven bridge
- A globally hosted dashboard on GitHub Pages

## Final Stack Copy

- Device: Arduino UNO R4 WiFi
- Sensors: DHT11 temperature/humidity sensor, photoresistor for day/night detection
- Edge security: `WiFiSSLClient` + MQTT over TLS on port `8883`
- Middleware: n8n MQTT Trigger + Supabase insert workflow
- Data warehouse: Supabase `sensor_logs` table
- Dashboard: React + Vite + TypeScript
- Hosting: GitHub Pages with `gh-pages` deployment
- Analytics access: Supabase REST API for historical data

## Phase 1: Securing the Edge

Replace plain MQTT with secure MQTT over TLS.

What this means:

- Change the Adafruit IO port from `1883` to `8883`
- Include `WiFiSSLClient.h`
- Use `WiFiSSLClient` instead of `WiFiClient`
- Pass the secure client into the MQTT client constructor

Why it matters:

- Protects credentials and sensor payloads in transit
- Matches the standard secure MQTT setup for enterprise IoT

Current implementation reference:

- [UNO R4 WiFi sketch](../hardware/uno-r4-wifi-smart-farm.ino)

## Phase 2: Power Management

Implement a wake-publish-sleep cycle to reduce power draw on a solar or battery node.

Recommended behavior:

- Connect to Wi-Fi on wake
- Connect to MQTT
- Read sensors and publish data
- Disconnect from the broker after a successful publish
- Turn off or deinitialize Wi-Fi where supported
- Wait 15 minutes before the next cycle
- Reconnect and repeat

Why it matters:

- Extends battery life
- Reduces idle network usage
- Makes the node practical for remote deployments

Current implementation reference:

- [UNO R4 WiFi sketch](../hardware/uno-r4-wifi-smart-farm.ino)

## Phase 3: Supabase Data Warehouse

Use Supabase as the long-term storage layer instead of relying on broker retention.

Required table:

- `sensor_logs`

Recommended columns:

- `id` for auto-incrementing identity
- `temperature` as a floating-point value
- `humidity` as a floating-point value
- `created_at` as a timestamp

Optional extensions:

- `node_id` to identify the sender
- `light` if you also want to persist photoresistor readings

Current repository reference:

- [Supabase schema](../sql/sensor_logs.sql)

## Phase 4: n8n Middleware

Use n8n to move payloads from Adafruit IO into Supabase without changing the hardware payload flow.

Workflow shape:

1. MQTT Trigger node listens to the Adafruit IO topic
2. Optional Code node normalizes the incoming payload
3. Supabase node inserts the data into `sensor_logs`

Mapping idea:

- MQTT `temperature` field → Supabase `temperature`
- MQTT `humidity` field → Supabase `humidity`
- MQTT timestamp or workflow timestamp → Supabase `created_at`

Why it matters:

- Keeps device code simple
- Moves data transformation into a server-side integration layer
- Makes the pipeline easier to maintain and secure

Current repository reference:

- [n8n to Supabase guide](n8n_mqtt_to_supabase.md)

## Phase 5: Global Presentation

Host the dashboard publicly so it is reachable from any device.

Frontend behavior:

- Use `wss://` or secure Supabase client access for live reads where applicable
- Fetch historical logs from the Supabase REST API or Supabase client
- Render charts and summaries for temperature and humidity trends

Deployment setup:

- Build the app with Vite
- Deploy with GitHub Pages using the repository workflow
- Keep the base path relative so Pages works correctly

Current implementation reference:

- [React app](../src/App.tsx)
- [Supabase client](../src/lib/supabase.ts)
- [GitHub Pages workflow](../.github/workflows/deploy.yml)

## Instructor Sign-Off Checklist

- Security: confirm `WiFiSSLClient` and port `8883`
- Power: confirm the disconnect and sleep cycle in Serial Monitor
- Middleware: confirm the n8n flow inserts rows successfully
- Analytics: confirm rows appear in Supabase `sensor_logs`
- Global hosting: confirm the dashboard loads from the GitHub Pages URL on mobile

## Stack Notes

If you want to swap platforms but keep the same architecture, the pattern stays the same:

- Device edge security
- Server-side middleware
- Persistent cloud warehouse
- Static or serverless dashboard hosting

Examples of equivalent alternatives:

- AWS IoT + Lambda + DynamoDB + S3/CloudFront
- MQTT broker + n8n self-host + PostgreSQL + Vercel
- Adafruit IO + Make.com + Supabase + Netlify

The main requirement is that the architecture preserves the same flow: secure device data in, server-side processing, durable storage, and globally reachable analytics.