# Analytics Interpretation and RLS Notes

## Analytics Output

The dashboard prediction uses a simple linear regression over the latest sensor history for each node.

- `Trend` shows the estimated change in temperature per hour.
- `1h` shows the forecasted temperature one hour ahead.
- `Predicted heat stress within 1 hour` appears when the forecast is at or above `35°C`.

This is intentionally lightweight: it gives a fast directional signal, not a guaranteed forecast. For better accuracy, the SQL views in `docs/analytics_views.sql` can be extended with longer windows, rolling averages, or per-node thresholds.

## RLS Notes

The preferred setup is:

- Writes happen through n8n or another trusted backend using the Supabase `service_role` key.
- The browser app uses only the `anon` key for reads.
- Row-level security should restrict direct writes from untrusted clients.

If you use the sample policies in `docs/rls_and_security.md`, make sure to keep the allow-list of node IDs tight and avoid exposing `service_role` anywhere in the frontend.

## Operational Check

Before going live, verify:

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in `.env`.
- `sensor_logs` exists and has recent data.
- The dashboard can fetch rows for at least one node.
- RLS policies still allow the trusted ingestion path and block public writes.
